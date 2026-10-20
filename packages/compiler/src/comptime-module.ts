import ts from "typescript";
import { Compiler } from "./compiler.js";
import { Module } from "./module.js";
import { ComptimeItem } from "./comptime.js";
import assert from "node:assert";
import { Package } from "./package.js";
import { dirname, relative } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

export class ComptimeModule {
	public readonly module: Module;
	public readonly comptimeImports: Map<string, ComptimeImport>;
	public readonly comptimeSymbols: Map<ts.Symbol, ComptimeItem>;

	private runtimeModule?: any;

	public get path() {
		return this.module.comptimePath;
	}

	public constructor(compiler: Compiler, module: Module) {
		this.module = module;

		this.comptimeImports = this.resolveComptimeImports(compiler);

		this.comptimeSymbols = new Map<ts.Symbol, ComptimeItem>();

		this.module.comptimeDeclarations.values().forEach(val => {
			this.comptimeSymbols.set(val.symbol, val);
			console.log("add", val.name);
		});
		this.comptimeImports.values().forEach(v => {
			v.comptimeSymbols.values().forEach(val => {
				this.comptimeSymbols.set(val.symbol, val);
				console.log("add", val.name);
			});
		});

		console.log(Array.from(this.comptimeSymbols.keys().map(k => k.name)))

		this.compile(compiler);
	}

	public async load() {
		if (!this.runtimeModule) {
			this.runtimeModule = await import(`file://${this.path}`);
			await Promise.all(this.comptimeImports.values().map(async i => {
				if (i.isExternal) {
					const mod = await import(`file://${i.comptimePath}`);
					for (const [_name, item] of i.comptimeSymbols) {
						item.result = mod[_name];
					}
				}
			}));
		}
	}

	public getComptimeValue(name: string) {
		assert.ok(this.runtimeModule, "Runtime Module is not loaded!");
		return this.runtimeModule[name];
	}

	public compile(compiler: Compiler) {
		const result = ts.transform(this.module.sourceFile, [this.transformer(compiler)]);
		try {
			const transformed = result.transformed[0]!;
			const transformedSource = ts.createPrinter({ removeComments: true }).printFile(transformed);
			const js = ts.transpileModule(transformedSource, {
				compilerOptions: {
					target: ts.ScriptTarget.ESNext,
					module: ts.ModuleKind.ESNext,
					removeComments: true,
					jsxImportSource: compiler.config.options.jsxImportSource!,
					jsx: ts.JsxEmit.ReactJSX,
					jsxFragmentFactory: compiler.config.options.jsxFragmentFactory!,
					jsxFactory: compiler.config.options.jsxFactory!,
				},
				fileName: this.module.sourceFile.fileName,
			});
			mkdirSync(dirname(this.path), { recursive: true });
			writeFileSync(this.path, js.outputText, "utf-8");
		} catch (e) {
			console.warn(e);
		} finally {
			result.dispose();
		}
	}

	private readonly transformer = (compiler: Compiler): ts.TransformerFactory<ts.SourceFile> => (ctx) => {
		const visit: ts.Visitor = node => {
			if (ts.isImportDeclaration(node)) {
				return this.rewriteImport(node);
			} else if (ts.isVariableStatement(node)) {
				return this.parseComptime(compiler, node);
			} else {
				return ts.visitEachChild(node, visit, ctx);
			}
		};

		return sourceFile => ts.visitNode(sourceFile, visit) as ts.SourceFile;
	}

	private rewriteImport(node: ts.ImportDeclaration): ts.Node {
		if (!ts.isStringLiteral(node.moduleSpecifier))
			return node;

		const clause = node.importClause;

		if (node.moduleSpecifier.text === "@ion/comptime" || !clause)
			return node;

		const comptimeImport = this.comptimeImports.get(node.moduleSpecifier.text);
		if (!comptimeImport?.isExternal) {
			return node;
		}
		const path = relative(dirname(this.module.path), comptimeImport.comptimePath!);
		const importPath = ts.factory.createStringLiteral(path);
		return ts.factory.updateImportDeclaration(node, node.modifiers, node.importClause, importPath, node.attributes,);
	}

	private resolveComptimeImports(compiler: Compiler): Map<string, ComptimeImport> {
		const imports = new Map<string, ComptimeImport>();

		this.module.sourceFile.statements.forEach(stmt => {
			if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
				const clause = stmt.importClause;

				const importPath = stmt.moduleSpecifier.text;

				if (importPath === "@ion/comptime" || !clause)
					return;

				const result = ts.resolveModuleName(importPath, this.module.sourceFile.fileName, compiler.config.options, ts.sys);
				const resolvedModule = result.resolvedModule;
				assert.ok(resolvedModule, `Could not resolve module path for import ${importPath}`);
				const path = resolvedModule.resolvedFileName;
				const isExternal = resolvedModule.isExternalLibraryImport || false;

				const pkg = isExternal ? Package.findFromSource(resolvedModule.resolvedFileName) : this.module.package;

				if (isExternal && !pkg.isComptime) {
					return;
				}

				if (clause.name) {
					console.log(`Default imports is not supported for now. At ${this.module.package.getRelativeSourcePath(this.module.path)}`);
				}

				if (clause.namedBindings) {
					if (ts.isNamespaceImport(clause.namedBindings)) {
						console.log(`Namespaced imports is not supported for now. At ${this.module.package.getRelativeSourcePath(this.module.path)}`);
						return;
					} else if (ts.isNamedImports(clause.namedBindings)) {
						const symbols = new Map<string, ComptimeItem>();
						const otherImports: string[] = [];
						
						let comptimePath: string | undefined;

						if (isExternal) {
							const relativePath = pkg.getRelativeSourcePath(path);
							const exports = pkg.comptimeManifest?.exports?.[relativePath];
							if (!exports)
								return;

							comptimePath = path.replace(pkg.sourceDir, pkg.comptimeOutput).replace(/\.tsx?$/, ".js");

							for (const element of clause.namedBindings.elements) {
								const txt = element.propertyName?.text ?? element.name.text;
								assert.ok(txt);
								if (!exports[txt])
									continue;

								let symbol = compiler.typeChecker.getSymbolAtLocation(element.name);
								assert.ok(symbol);
								symbol = symbol.flags & ts.SymbolFlags.Alias ? compiler.typeChecker.getAliasedSymbol(symbol) : symbol;
								const type = exports[txt]!;
								symbols.set(txt, { name: txt, symbol, type, comptimeModulePath: comptimePath, isExternal: true });
							}
						} else {
							const targetModule = compiler.modules.get(path);
							assert.ok(targetModule, `Could not get local module at ${path}!`);
							for (const element of clause.namedBindings.elements) {
								const txt = element.propertyName?.text ?? element.name.text;
								assert.ok(txt);
								const comptimeItem = targetModule.comptimeDeclarations.get(txt);
								if (comptimeItem) {
									symbols.set(txt, comptimeItem);
								} else {
									otherImports.push(txt);
								}
							}
						}

						imports.set(importPath, {
							importPath: importPath,
							comptimeSymbols: symbols,
							comptimePath,
							declaration: stmt,
							isExternal,
							otherImports
						});
					}
				}
			}
		});

		return imports;
	}

	private parseComptime(compiler: Compiler, node: ts.VariableStatement): ts.Node {
		for (const declaration of node.declarationList.declarations) {
			if (ts.isIdentifier(declaration.name) && declaration.initializer) {
				let declSymbol = compiler.typeChecker.getSymbolAtLocation(declaration.name);
				assert.ok(declSymbol, "Could not get declaration symbol!");
				declSymbol = declSymbol.flags & ts.SymbolFlags.Alias ? compiler.typeChecker.getAliasedSymbol(declSymbol) : declSymbol;
				const s = this.comptimeSymbols.get(declSymbol);
				if (s) {
					const modifiers = node.modifiers ? [...node.modifiers] : [];
					if (!modifiers.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
						modifiers.unshift(ts.factory.createModifier(ts.SyntaxKind.ExportKeyword));
					}
					return ts.factory.updateVariableStatement(node, modifiers, node.declarationList);
				}

			}
		}

		return node;
	}
}

export type ComptimeImport = {
	readonly declaration: ts.ImportDeclaration;
	readonly importPath: string;
	readonly isExternal: boolean;
	readonly comptimePath: string | undefined;
	readonly comptimeSymbols: Map<string, ComptimeItem>;
	readonly otherImports: string[];
}