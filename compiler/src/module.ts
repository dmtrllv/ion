
import * as ts from "typescript";

export class Module {
	public readonly path: string;
	public readonly sourceFile: ts.SourceFile;
	public readonly usesComptime: boolean;
	public readonly macroDeclarations: MacroDeclaration[];
	public readonly removeStatements: ts.Node[];
	public readonly imports: Import[];
	public readonly exports: Export[];
	public readonly reExports: ReExport[];

	public constructor(
		typeChecker: ts.TypeChecker,
		relativePath: string,
		sourceFile: ts.SourceFile,
		removeStatements: ts.Node[],
		macroDeclarations: MacroDeclaration[],
		compilerOptions: ts.CompilerOptions,
	) {
		this.path = relativePath;
		this.sourceFile = sourceFile;
		this.usesComptime = macroDeclarations.length !== 0;
		this.macroDeclarations = macroDeclarations;
		this.removeStatements = removeStatements;
		this.imports = this.resolveImports(typeChecker, compilerOptions);
		this.exports = this.resolveExports(typeChecker);
		this.reExports = this.resolveReExports();
	}

	private resolveImports(
		typeChecker: ts.TypeChecker,
		compilerOptions: ts.CompilerOptions,
	): Import[] {
		const imports: Import[] = [];

		for (const node of this.sourceFile.statements) {
			if (
				!ts.isImportDeclaration(node) ||
				!ts.isStringLiteral(node.moduleSpecifier)
			) {
				continue;
			}

			const clause = node.importClause;
			const symbols: Record<string, ts.Symbol> = {};

			if (clause) {
				if (clause.name) {
					const symbol = typeChecker.getSymbolAtLocation(clause.name);
					if (symbol) symbols["default"] = symbol;
				}

				const bindings = clause.namedBindings;

				if (bindings && ts.isNamespaceImport(bindings)) {
					const symbol = typeChecker.getSymbolAtLocation(bindings.name);
					if (symbol) symbols["*"] = symbol;
				} else if (bindings && ts.isNamedImports(bindings)) {
					for (const element of bindings.elements) {
						const symbol = typeChecker.getSymbolAtLocation(element.name);
						if (symbol) {
							symbols[element.propertyName?.text ?? element.name.text] =
								symbol;
						}
					}
				}
			}

			const result = ts.resolveModuleName(
				node.moduleSpecifier.text,
				this.sourceFile.fileName,
				compilerOptions,
				ts.sys,
			);

			const absolutePath = result.resolvedModule?.resolvedFileName;

			if (!absolutePath) {
				throw new Error(
					`Could not resolve import "${node.moduleSpecifier.text}" in ${this.sourceFile.fileName}`,
				);
			}

			imports.push({
				absolutePath,
				path: node.moduleSpecifier.text,
				node,
				symbols,
			});
		}

		return imports;
	}

	private resolveExports(typeChecker: ts.TypeChecker): Export[] {
		const moduleSymbol = typeChecker.getSymbolAtLocation(this.sourceFile);

		if (!moduleSymbol) return [];

		return typeChecker.getExportsOfModule(moduleSymbol).map((symbol) => ({
			name: symbol.name,
			symbol,
			target: this.resolveAlias(typeChecker, symbol),
		}));
	}

	private resolveAlias(
		typeChecker: ts.TypeChecker,
		symbol: ts.Symbol,
	): ts.Symbol {
		if ((symbol.flags & ts.SymbolFlags.Alias) === 0) {
			return symbol;
		}

		return typeChecker.getAliasedSymbol(symbol);
	}

	private resolveReExports(): ReExport[] {
		const reExports: ReExport[] = [];

		for (const node of this.sourceFile.statements) {
			if (
				!ts.isExportDeclaration(node) ||
				!node.moduleSpecifier ||
				!ts.isStringLiteral(node.moduleSpecifier)
			) {
				continue;
			}

			const clause = node.exportClause;

			if (!clause) {
				reExports.push({
					path: node.moduleSpecifier.text,
					node,
					kind: "all",
				});
				continue;
			}

			if (ts.isNamespaceExport(clause)) {
				reExports.push({
					path: node.moduleSpecifier.text,
					node,
					kind: "namespace",
					exportedName: clause.name.text,
				});
				continue;
			}

			for (const element of clause.elements) {
				reExports.push({
					path: node.moduleSpecifier.text,
					node,
					kind: "named",
					exportedName: element.name.text,
					importedName: element.propertyName?.text ?? element.name.text,
				});
			}
		}

		return reExports;
	}

	public get fullPath(): string {
		return this.sourceFile.fileName;
	}
}

export type MacroDeclaration = {
	readonly type: MacroType;
	readonly statement: ts.VariableDeclaration;
};

export type MacroType =
	| "comptime"
	| "comptime.fn"
	| "macro.generate"
	| "macro.attribute";

export type Import = {
	absolutePath: string;
	path: string;
	node: ts.ImportDeclaration;
	symbols: Record<string, ts.Symbol>;
	module?: Module | undefined;
};

export type Export = {
	/** Name exposed by this module. */
	readonly name: string;
	/** Symbol as exposed by this module. */
	readonly symbol: ts.Symbol;
	/** Original symbol after resolving TypeScript aliases. */
	readonly target: ts.Symbol;
};

export type ReExport = {
	readonly path: string;
	readonly node: ts.ExportDeclaration;
	readonly kind: "all" | "namespace" | "named";
	readonly exportedName?: string;
	readonly importedName?: string;
	module?: Module | undefined;
};
