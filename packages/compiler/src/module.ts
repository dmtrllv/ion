import * as ts from "typescript";
import { Compiler } from "./compiler.js";
import { Package } from "./package.js";
import { cached } from "./utils.js";

export class Module {
	public readonly path: string;
	public readonly source: ts.SourceFile;
	public readonly checker: ts.TypeChecker;
	public readonly imports: Import[];
	public readonly exports: Export[];
	private readonly forwardExports: AliasedExport[] = [];

	public constructor(compiler: Compiler, path: string, source: ts.SourceFile) {
		this.path = path;
		this.source = source;
		this.checker = compiler.program.getTypeChecker();
		this.imports = this.resolveImports(compiler, source);
		this.exports = this.resolveExports(compiler, source);
	}

	@cached
	public get comptimeImports(): Import[] {
		return this.imports.filter(i => i.path === "@ion/comptime");
	}

	@cached
	public get comptimeExports(): Export[] {
		return this.exports.filter(ex => ex.isComptime);
	}

	@cached
	public get hasComptimeExports(): boolean {
		return this.comptimeExports.length > 0;
	}

	private resolveImports(compiler: Compiler, source: ts.SourceFile) {
		const imports: Import[] = [];
		const errors: Error[] = [];

		for (const statement of source.statements) {
			if (!ts.isImportDeclaration(statement))
				continue;

			const clause = statement.importClause;

			if (!clause)
				continue;

			const importSymbols: ImportSymbol[] = [];

			const path = (statement.moduleSpecifier as ts.StringLiteral).text;

			const add = (local: ts.Identifier, type: ImportSymbol["type"]) => {
				const localSymbol = this.checker.getSymbolAtLocation(local);
				if (!localSymbol)
					throw new Error(`Could not get local symbol for import ${local.text}}`);

				const sourceSymbol = localSymbol && (localSymbol.flags & ts.SymbolFlags.Alias) ? this.checker.getAliasedSymbol(localSymbol) : undefined;
				if (!sourceSymbol)
					throw new Error(`Could not get source for import ${local.text}}`);

				importSymbols.push({
					localSymbol,
					sourceSymbol,
					type,
					name: local.text,
					isComptime: path === "@ion/comptime"
				});
			}

			if (clause.name) {
				add(clause.name, "default");
			}

			const bindings = clause.namedBindings;
			if (!bindings)
				continue;

			if (ts.isNamespaceImport(bindings)) {
				add(bindings.name, "namespace");
				continue;
			}

			for (const element of bindings.elements) {
				add(element.name, "named");
			}

			const result = ts.resolveModuleName(path, source.fileName, compiler.config.options, ts.sys);
			if (!result.resolvedModule) {
				errors.push(new Error(`Could not resolve import path for ${path}!`));
				continue;
			}
			imports.push(new Import(compiler, path, result.resolvedModule, importSymbols));
		}

		if (errors.length > 0)
			throw new AggregateError(errors);

		return imports;
	}

	private resolveExports(compiler: Compiler, source: ts.SourceFile) {
		const exports = [];

		for (const statement of source.statements) {
			if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
				const path = (statement.moduleSpecifier as ts.StringLiteral).text;

				const result = ts.resolveModuleName(path, source.fileName, compiler.config.options, ts.sys);
				if (!result.resolvedModule)
					throw new Error(`Could not resolve import path for ${path}!`);

				const resolvedPath = result.resolvedModule.resolvedFileName;
				const sourceFile = compiler.program.getSourceFile(resolvedPath);
				if (!sourceFile)
					throw new Error(`Could not get source file for ${resolvedPath}!`);

				const moduleSymbol = this.checker.getSymbolAtLocation(sourceFile);
				if (!moduleSymbol)
					throw new Error(`Could not get module symbol for export ${path}`);

				const sourcePackage = Package.fromModulePath(resolvedPath);
				const isExternal = result.resolvedModule.isExternalLibraryImport || false;

				if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
					this.forwardExports.push({
						type: "named",
						elements: statement.exportClause.elements.filter(element => !element.isTypeOnly && !statement.isTypeOnly),
						moduleSymbol,
						path: resolvedPath,
						sourcePackage,
						isExternal
					});
				} else if (!statement.exportClause) {
					this.forwardExports.push({
						type: "*",
						moduleSymbol,
						path: resolvedPath,
						sourcePackage,
						isExternal
					});
				}
			} else if (ts.isExportDeclaration(statement) && statement.exportClause) {
				if (ts.isNamedExports(statement.exportClause)) {
					for (const element of statement.exportClause.elements) {
						const symbol = this.checker.getSymbolAtLocation(element.name);
						if (!symbol)
							throw new Error(`Could not get symbol for export ${element.name.text}`);

						const declSymbol = symbol.flags & ts.SymbolFlags.Alias ? this.checker.getAliasedSymbol(symbol) : symbol;
						exports.push(new Export(element.name.text, symbol, this.getComptimeType(declSymbol), null, false, null));
					}
				}
			} else if (ts.canHaveModifiers(statement) && ts.getModifiers(statement)?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
				if (ts.isVariableStatement(statement)) {
					for (const declaration of statement.declarationList.declarations) {
						if (ts.isIdentifier(declaration.name)) {
							const symbol = this.checker.getSymbolAtLocation(declaration.name);
							if (!symbol)
								throw new Error(`Could not get symbol for export ${declaration.name.text}`);

							const declSymbol = symbol.flags & ts.SymbolFlags.Alias ? this.checker.getAliasedSymbol(symbol) : symbol;
							exports.push(new Export(declaration.name.text, symbol, this.getComptimeType(declSymbol), null, false, null));
						}
					}
				} else if (ts.isExportAssignment(statement)) {
					const symbol = this.checker.getSymbolAtLocation(statement.expression);
					if (symbol)
						exports.push(new Export("default", symbol, this.getComptimeType(symbol), null, false, null));
				}
			}
		}

		return exports;
	}

	public getComptimeTypeFromIdentifier(name: ts.Identifier) {
		const symbol = this.checker.getSymbolAtLocation(name);
		if (!symbol)
			throw new Error(`Could not get symbol for export ${name.text}`);

		const declSymbol = symbol.flags & ts.SymbolFlags.Alias ? this.checker.getAliasedSymbol(symbol) : symbol;
		return this.getComptimeType(declSymbol);
	}

	public getComptimeType(symbol: ts.Symbol): ComptimeType | null {
		// TODO: also resolve wrapped function calls that end up in a comptime or comptime.fn 
		const declaration = symbol.valueDeclaration;

		if (!declaration || !ts.isVariableDeclaration(declaration) || !declaration.initializer) {
			return null;
		}

		const initializer = declaration.initializer;

		if (!ts.isCallExpression(initializer))
			return null;

		const callee = initializer.expression;

		const isComptimeSymbol = (symbol: ts.Node) => this.comptimeImports.flatMap(imp => imp.symbols).some(s => s.localSymbol === this.checker.getSymbolAtLocation(symbol));

		if (ts.isIdentifier(callee)) {
			return isComptimeSymbol(callee) ? "comptime" : null;
		} else if (ts.isPropertyAccessExpression(callee) && callee.name.text === "macro") {
			return isComptimeSymbol(callee.expression) ? "comptime.macro" : null;
		}
		return null;
	}

	public resolveExportAliases(compiler: Compiler, modules: Map<string, Module>): void {
		const checker = compiler.program.getTypeChecker();
		this.forwardExports.forEach(e => {
			if (e.type === "*") {
				if (e.isExternal) {
					const sourcePath = e.sourcePackage.getRealtiveSourcePathFromTyping(e.path);
					const p = e.sourcePackage.getComptimePath(sourcePath);
					const exports = e.sourcePackage.comptimeManifest?.[sourcePath];
					if (exports) {
						for (const ex in exports) {
							const symbol = checker.getExportsOfModule(e.moduleSymbol).find(s => s.name === ex);
							if (!symbol)
								throw new Error(`Could not get symbol for export ${ex}`);
							this.exports.push(new Export(ex, symbol, exports[ex]!, e.path, true, p))
						}
					}
				} else {
					const p = e.sourcePackage.getComptimePath(e.path);
					const sourceModule = modules.get(e.path);
					if (!sourceModule)
						throw new Error(`Could not get source module for ${e.path}!`);
					for (const symbol of checker.getExportsOfModule(e.moduleSymbol)) {
						const declSymbol = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
						this.exports.push(new Export(symbol.name, symbol, sourceModule.getComptimeType(declSymbol), e.path, false, p));
					}
				}
			} else {
				if (e.isExternal) {
					const sourcePath = e.sourcePackage.getRealtiveSourcePath(e.path);
					const p = e.sourcePackage.getComptimePath(sourcePath);
					const exports = e.sourcePackage.comptimeManifest?.[sourcePath];
					for (const element of e.elements) {
						const name = (element.propertyName ?? element.name).text;
						const symbol = checker.getExportsOfModule(e.moduleSymbol).find(s => s.name === name);
						
						if (!symbol)
							throw new Error(`Could not get symbol for export ${name}`);

						if (!exports?.[name])
							throw new Error(`Could not get symbol for export ${name}`);

						this.exports.push(new Export(name, symbol, exports?.[name], e.path, true, p));
					}
				} else {
					const sourceModule = modules.get(e.path);
					const p = e.sourcePackage.getComptimePath(e.path);
					if (!sourceModule)
						throw new Error(`Could not get source module for ${e.path}!`);
					for (const element of e.elements) {
						const name = (element.propertyName ?? element.name).text;
						const symbol = checker.getExportsOfModule(e.moduleSymbol).find(s => s.name === name);
						if (!symbol)
							throw new Error(`Could not get symbol for export ${name}`);

						const declSymbol = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
						const declaration = declSymbol.valueDeclaration ?? declSymbol.declarations?.[0];
						const declarationModule = declaration && modules.get(declaration.getSourceFile().fileName);
						const type = declarationModule?.getComptimeType(declSymbol) ?? null;
						this.exports.push(new Export(element.name.text, symbol, type, e.path, false, p));
					}
				}
			}
		});
	}
}

export class Import {
	public readonly path: string;
	public readonly modulePath: string;
	public readonly isExternal: boolean;
	public readonly sourcePackage: Package;
	public readonly comptimePath: string;
	public readonly symbols: ImportSymbol[];

	public constructor(compiler: Compiler, path: string, resolvedModule: ts.ResolvedModuleFull, symbols: ImportSymbol[]) {
		this.path = path;
		this.modulePath = resolvedModule.resolvedFileName;
		this.isExternal = resolvedModule.isExternalLibraryImport || false;
		this.symbols = symbols;

		if (this.isExternal) {
			this.sourcePackage = Package.fromModulePath(this.modulePath);
			const comptimePath = this.sourcePackage.comptimeOutput;
			const srcPath = this.sourcePackage.sourceDir;
			this.comptimePath = this.modulePath.replace(srcPath, comptimePath).replace(/(\.d)?\.tsx?$/, ".js");
		} else {
			this.sourcePackage = compiler.root;
			const comptimePath = this.sourcePackage.comptimeOutput;
			const srcPath = this.sourcePackage.sourceDir;
			this.comptimePath = this.modulePath.replace(srcPath, comptimePath).replace(/\.tsx?$/, ".js");
		}
	}
}

export type ImportSymbol = {
	type: "namespace" | "named" | "default";
	name?: string;
	localSymbol: ts.Symbol;
	sourceSymbol: ts.Symbol;
	isComptime: boolean;
};

export class Export {
	public readonly name: string;
	public readonly symbol: ts.Symbol | null;
	public readonly isComptime: boolean;
	public readonly type: ComptimeType | null;
	public readonly from: string | null;
	public readonly isExternal: boolean;
	public readonly comptimePath: string | null;

	public constructor(name: string, symbol: ts.Symbol | null, type: ComptimeType | null, from: string | null, external: boolean, comptimePath: string | null) {
		this.name = name;
		this.symbol = symbol;
		this.type = type;
		this.isComptime = type !== null;
		this.from = from;
		this.isExternal = external;
		this.comptimePath = comptimePath;
	}
};

export type ComptimeType = "comptime" | "comptime.fn" | "comptime.macro";

type AliasedExport = {
	path: string;
	sourcePackage: Package;
	type: "named";
	elements: ts.ExportSpecifier[];
	isExternal: boolean;
	moduleSymbol: ts.Symbol;
} | {
	path: string;
	sourcePackage: Package;
	type: "*",
	moduleSymbol: ts.Symbol;
	isExternal: boolean;
}