
import * as ts from "typescript";
import { Compiler } from "../compiler.js";
import { Export, Import, MacroDeclaration, MacroType, Module } from "../module.js";
import { Pass } from "./pass.js";

export class ModuleResolver implements Pass<ModuleMap> {
	public async run(compiler: Compiler): Promise<ModuleMap> {
		const sourceFiles = compiler.sourcePaths.map((path) => compiler.getSource(path),);

		const entryPoints = this.resolveImports(compiler.typeChecker, sourceFiles,);

		const modules: ModuleMap = {};

		for (const path of compiler.sourcePaths) {
			modules[path] = this.resolve(
				compiler.typeChecker,
				compiler.options,
				compiler.relativePath(path),
				compiler.getSource(path),
				entryPoints,
			);
		}

		this.linkModules(modules, compiler.options);
		this.removeNonComptimeVariableDeclarations(modules);
		return modules;
	}

	private linkModules(modules: ModuleMap, compilerOptions: ts.CompilerOptions): void {
		const modulesByFile = new Map<string, Module>();

		for (const [path, module] of Object.entries(modules)) {
			modulesByFile.set(path, module);
			modulesByFile.set(module.fullPath, module);
		}

		for (const module of Object.values(modules)) {
			for (const imported of module.imports) {
				if (imported.path === "@ion/comptime") {
					continue;
				}

				imported.module = modulesByFile.get(imported.absolutePath);
			}

			for (const reExport of module.reExports) {
				const result = ts.resolveModuleName(
					reExport.path,
					module.sourceFile.fileName,
					compilerOptions,
					ts.sys,
				);

				const absolutePath = result.resolvedModule?.resolvedFileName;

				if (absolutePath) {
					reExport.module = modulesByFile.get(absolutePath);
				}
			}
		}

		for (const module of Object.values(modules)) {
			for (const exported of module.exports) {
				exported.targetModule = this.findDeclarationModule(
					exported.target,
					modulesByFile,
				);
			}
		}
	}

	private findDeclarationModule(symbol: ts.Symbol, modulesByFile: Map<string, Module>): Module | undefined {
		for (const declaration of symbol.declarations ?? []) {
			const module = modulesByFile.get(declaration.getSourceFile().fileName,);

			if (module) {
				return module;
			}
		}

		return undefined;
	}

	public isComptimeExport(exported: Export): boolean {
		return exported.targetModule?.getComptimeDeclaration(exported.target) !== undefined;
	}

	public resolve(typeChecker: ts.TypeChecker, compilerOptions: ts.CompilerOptions, relativePath: string, source: ts.SourceFile, entryPoints: Map<ts.Symbol, MacroType>,): Module {
		const macroDeclarations: MacroDeclaration[] = [];
		const removeStatements: ts.Node[] = [];

		for (const statement of source.statements) {
			if (ts.isVariableStatement(statement)) {
				for (const declaration of statement.declarationList.declarations) {
					if (ts.isIdentifier(declaration.name) && declaration.initializer && ts.isCallExpression(declaration.initializer)) {
						const type = this.resolveMacroType(declaration.initializer.expression, typeChecker, entryPoints);

						if (type) {
							macroDeclarations.push({
								type,
								statement: declaration,
							});

							continue;
						}
					}
				}

				continue;
			}

			if (this.shouldRemoveStatement(statement, typeChecker)) {
				removeStatements.push(statement);
			}
		}

		return new Module(typeChecker, relativePath, source, removeStatements, macroDeclarations, compilerOptions,);
	}


	private resolveImports(typeChecker: ts.TypeChecker, sourceFiles: readonly ts.SourceFile[],): Map<ts.Symbol, MacroType> {
		const entryPoints = new Map<ts.Symbol, MacroType>();

		const resolveAlias = (symbol: ts.Symbol): ts.Symbol => {
			return (symbol.flags & ts.SymbolFlags.Alias) !== 0
				? typeChecker.getAliasedSymbol(symbol)
				: symbol;
		};

		const registerApi = (moduleSymbol: ts.Symbol): void => {
			for (const exported of typeChecker.getExportsOfModule(moduleSymbol)) {
				const symbol = resolveAlias(exported);

				if (exported.name === "comptime") {
					entryPoints.set(symbol, "comptime");

					const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];

					if (!declaration) {
						continue;
					}

					const comptimeType = typeChecker.getTypeOfSymbolAtLocation(symbol, declaration);

					const fn = typeChecker.getPropertyOfType(comptimeType, "fn");

					if (fn) {
						entryPoints.set(resolveAlias(fn), "comptime.fn");
					}
				}

				if (exported.name === "macro") {
					const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];

					if (!declaration) {
						continue;
					}

					const macroType = typeChecker.getTypeOfSymbolAtLocation(
						symbol,
						declaration,
					);

					const options = [
						["generate", "macro.generate"],
						["attribute", "macro.attribute"],
					] as const;

					for (const [name, macroTypeName] of options) {
						const property = typeChecker.getPropertyOfType(macroType, name,);

						if (property) {
							entryPoints.set(
								resolveAlias(property),
								macroTypeName,
							);
						}
					}
				}
			}
		};

		for (const sourceFile of sourceFiles) {
			for (const statement of sourceFile.statements) {
				if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== "@ion/comptime") {
					continue;
				}

				const moduleSymbol = typeChecker.getSymbolAtLocation(
					statement.moduleSpecifier,
				);

				if (moduleSymbol) {
					registerApi(moduleSymbol);
				}
			}
		}

		return entryPoints;
	}

	private resolveAlias(typeChecker: ts.TypeChecker, symbol: ts.Symbol): ts.Symbol {
		let current = symbol;

		while ((current.flags & ts.SymbolFlags.Alias) !== 0) {
			const target = typeChecker.getAliasedSymbol(current);

			if (target === current) {
				break;
			}

			current = target;
		}

		return current;
	}


	private removeNonComptimeVariableDeclarations(
		modules: ModuleMap,
	): void {
		for (const module of Object.values(modules)) {
			for (const statement of module.sourceFile.statements) {
				if (!ts.isVariableStatement(statement)) {
					continue;
				}

				for (const declaration of statement.declarationList.declarations) {
					const initializer = declaration.initializer;

					if (!initializer || !ts.isCallExpression(initializer)) {
						continue;
					}

					const symbol = module.typeChecker.getSymbolAtLocation(
						initializer.expression,
					);

					if (!symbol) {
						module.removeStatements.push(declaration);
						continue;
					}

					const target = this.resolveAlias(module.typeChecker, symbol);

					const comptimeDeclaration =
						module.getComptimeDeclarationForSymbol(target) ??
						(() => {
							for (const imported of module.imports) {
								for (const [name, importedSymbol] of Object.entries(imported.symbols)) {
									if (this.resolveAlias(module.typeChecker, importedSymbol) !== target) {
										continue;
									}

									const comptimeImport = imported.module?.getComptimeImport(name);

									if (comptimeImport) {
										return comptimeImport;
									}
								}
							}

							return undefined;
						})();

					if (comptimeDeclaration?.type !== "comptime.fn" && comptimeDeclaration?.type !== "comptime") {
						module.removeStatements.push(declaration);
					}
				}
			}
		}
	}

	private resolveMacroType(expression: ts.Expression, typeChecker: ts.TypeChecker, entryPoints: Map<ts.Symbol, MacroType>): MacroType | undefined {
		const symbol = typeChecker.getSymbolAtLocation(expression);

		if (!symbol) {
			return undefined;
		}

		return entryPoints.get(this.resolveAlias(typeChecker, symbol));
	}

	private shouldRemoveStatement(statement: ts.Statement, checker: ts.TypeChecker): boolean {
		if (
			ts.isImportDeclaration(statement) ||
			ts.isImportEqualsDeclaration(statement) ||
			ts.isFunctionDeclaration(statement) ||
			ts.isClassDeclaration(statement) ||
			ts.isInterfaceDeclaration(statement) ||
			ts.isTypeAliasDeclaration(statement) ||
			ts.isModuleDeclaration(statement)
		) {
			return false;
		}

		let shouldRemove = false;

		const visit = (node: ts.Node): void => {
			if (shouldRemove) {
				return;
			}

			if (ts.isCallExpression(node)) {
				shouldRemove = true;
				return;
			}

			if (ts.isPropertyAccessExpression(node)) {
				const symbol = checker.getSymbolAtLocation(node.name);
				const declarations = symbol?.declarations ?? [];

				if (
					declarations.some(
						declaration =>
							ts.isGetAccessorDeclaration(declaration),
					)
				) {
					shouldRemove = true;
					return;
				}
			}

			node.forEachChild(visit);
		};

		visit(statement);

		return shouldRemove;
	}

	public getComptimeImport(imported: Import, importedName: string): MacroDeclaration | undefined {
		return imported.module?.getComptimeImport(importedName);
	}
}

export type ModuleMap = Record<string, Module>;
