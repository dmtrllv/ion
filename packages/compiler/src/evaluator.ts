import ts from "typescript";
import { ComptimeModule } from "./comptime-module.js";
import { Compiler } from "./compiler.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import assert from "node:assert";
import { createContext, toExpression } from "./comptime-context.js";
import { Comptime } from "@ion/comptime";

declare namespace globalThis {
	let __IS_COMPTIME__: boolean;
}

globalThis.__IS_COMPTIME__ = true;

export class Evaluator {
	public evaluate(compiler: Compiler, comptimeModules: ComptimeModule[]) {
		comptimeModules.forEach(mod => this.evaluateAndCompile(compiler, mod, comptimeModules));
	}

	private evaluateAndCompile(compiler: Compiler, competimeModule: ComptimeModule, comptimeModules: ComptimeModule[]) {
		const result = ts.transform(competimeModule.module.sourceFile, [this.transformer(compiler, competimeModule, comptimeModules)]);
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
				fileName: competimeModule.module.sourceFile.fileName,
			});
			mkdirSync(dirname(competimeModule.module.buildPath), { recursive: true });
			writeFileSync(competimeModule.module.buildPath, js.outputText, "utf-8");
		} catch (e) {
			console.warn(e);
		} finally {
			result.dispose();
		}
	}

	private readonly transformer = (compiler: Compiler, comptimeModule: ComptimeModule, comptimeModules: ComptimeModule[]): ts.TransformerFactory<ts.SourceFile> => (ctx) => {
		const addedImports: Record<string, Set<string>> = {};

		const visit: ts.Visitor = node => {
			if (ts.isVariableStatement(node)) {
				const transformed = this.transformComptimeStmt(compiler, node, comptimeModule);

				if (!transformed)
					return undefined;

				return ts.visitEachChild(transformed, visit, ctx);
			}

			if (ts.isCallExpression(node)) {
				return ts.visitEachChild(this.transformCall(compiler, node, comptimeModule, comptimeModules, addedImports), visit, ctx);
			}

			if (ts.isIdentifier(node)) {
				return this.transformIdent(compiler, node, comptimeModule, comptimeModules);
			}

			return ts.visitEachChild(node, visit, ctx);
		};

		return sourceFile => {
			const statements: ts.Statement[] = [];
			const imports = new Map<string, number>();

			for (const statement of sourceFile.statements) {
				if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
					const transformed = this.transformImport(statement, comptimeModule, addedImports);

					if (transformed && ts.isImportDeclaration(transformed)) {
						imports.set((transformed.moduleSpecifier as ts.StringLiteral).text, statements.length);
						statements.push(transformed);
					}

					continue;
				}

				const transformed = ts.visitNode(statement, visit);

				if (transformed)
					statements.push(transformed as ts.Statement);
			}

			for (const [module, names] of Object.entries(addedImports)) {
				if (names.size === 0)
					continue;

				const index = imports.get(module);

				if (index !== undefined) {
					const statement = statements[index] as ts.ImportDeclaration;
					const clause = statement.importClause;

					if (clause && clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
						const existing = new Set(clause.namedBindings.elements.map(element => element.name.text));
						const elements = [...clause.namedBindings.elements];

						for (const name of names) {
							if (!existing.has(name))
								elements.push(ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier(name)));
						}

						const namedImports = ts.factory.updateNamedImports(clause.namedBindings, elements);
						const importClause = ts.factory.updateImportClause(clause, clause.phaseModifier, clause.name, namedImports);

						statements[index] = ts.factory.updateImportDeclaration(statement, statement.modifiers, importClause, statement.moduleSpecifier, statement.attributes);
					}

					continue;
				}

				statements.unshift(ts.factory.createImportDeclaration(undefined, ts.factory.createImportClause(undefined, undefined, ts.factory.createNamedImports(Array.from(names, name => ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier(name))))), ts.factory.createStringLiteral(module), undefined));
			}

			return ts.factory.updateSourceFile(sourceFile, statements);
		};
	}

	private transformImport(node: ts.ImportDeclaration, comptimeModule: ComptimeModule, addedImports: Record<string, Set<string>>) {
		const clause = node.importClause;
		if (!ts.isStringLiteral(node.moduleSpecifier) || !clause || clause.name)
			return node;

		const importName = node.moduleSpecifier.text;
		if (importName === "@ion/comptime")
			return undefined;

		if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
			const found = comptimeModule.comptimeImports.values().find(i => i.importPath === importName);
			if (found) {
				const comptimeSymbols = Array.from(found.comptimeSymbols.values().map(v => v.name));
				const elements: ts.ImportSpecifier[] = [];
				for (const element of clause.namedBindings.elements) {
					const name = element.propertyName?.text ?? element.name.text;
					if (!comptimeSymbols.includes(name)) {
						elements.push(element)
					}
				}
				const toAdd = addedImports[importName];
				if (toAdd) {
					for (const val in toAdd) {
						elements.push(ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier(val)))
					}
				}
				if (elements.length > 0) {
					const namedImports = ts.factory.updateNamedImports(clause.namedBindings as ts.NamedImports, elements);
					const importClause = ts.factory.updateImportClause(clause, undefined, clause.name, namedImports);
					return ts.factory.updateImportDeclaration(node, node.modifiers, importClause, node.moduleSpecifier, node.attributes);
				} else {
					return undefined;
				}
			}
		}

		return node;
	}

	private transformComptimeStmt(compiler: Compiler, node: ts.VariableStatement, comptimeModule: ComptimeModule): ts.Node | undefined {
		let remove = false;
		const declarations = node.declarationList.declarations.map(declaration => {
			if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
				return declaration;
			}

			let declSymbol = compiler.typeChecker.getSymbolAtLocation(declaration.name);
			assert.ok(declSymbol, "Could not get declaration symbol!");

			if (declSymbol.flags & ts.SymbolFlags.Alias) {
				declSymbol = compiler.typeChecker.getAliasedSymbol(declSymbol);
			}

			const s = comptimeModule.comptimeSymbols.get(declSymbol);
			if (!s)
				return declaration;

			console.log("stmt with comptime", declSymbol.name, s.name, s.type)

			if (s.type === "comptime.fn" || s.type === "comptime.macro") {
				remove = true;
				return declaration;
			}

			const val = comptimeModule.getComptimeValue(s.name);
			if (val["__COMPTIME_MACRO_FN__"] || val["__COMPTIME_CONST_FN__"]) {
				remove = true;
				return declaration;
			}
			return ts.factory.updateVariableDeclaration(declaration, declaration.name, declaration.exclamationToken, declaration.type, toExpression(val));
		});

		if (remove)
			return undefined;

		const declarationList = ts.factory.updateVariableDeclarationList(node.declarationList, declarations,);
		return ts.factory.updateVariableStatement(node, node.modifiers, declarationList);
	}

	// for comptime ident replacement (maybe make it later inline?)
	private transformIdent(compiler: Compiler, node: ts.Identifier, _comptimeModule: ComptimeModule, _comptimeModules: ComptimeModule[]): ts.Node | undefined {
		let symbol = compiler.typeChecker.getSymbolAtLocation(node);
		if (!symbol)
			return node;
		symbol = symbol.flags & ts.SymbolFlags.Alias ? compiler.typeChecker.getAliasedSymbol(symbol) : symbol;
		const comptimeItem = _comptimeModule.comptimeSymbols.get(symbol);
		if (!comptimeItem || !("result" in comptimeItem))
			return node;
		return node;
	}

	private transformCall(compiler: Compiler, node: ts.CallExpression, comptimeModule: ComptimeModule, _comptimeModules: ComptimeModule[], addedImports: Record<string, Set<string>>): ts.Node | undefined {
		if (!ts.isIdentifier(node.expression)) {
			return node;
		}

		let symbol = compiler.typeChecker.getSymbolAtLocation(node.expression);
		assert.ok(symbol);
		symbol = symbol.flags & ts.SymbolFlags.Alias ? compiler.typeChecker.getAliasedSymbol(symbol) : symbol;
		const comptimeItem = comptimeModule.comptimeSymbols.get(symbol);
		if (!comptimeItem || !("result" in comptimeItem))
			return node;

		if (comptimeItem.result["__COMPTIME_MACRO_FN__"]) {
			console.log("executing macro");
			const macro = comptimeItem.result["__COMPTIME_MACRO_FN__"] as MacroFn;
			const fnReferences: any[] = [];
			const ast = macro(createContext(node, fnReferences), ...node.arguments.map(arg => arg) as any[]);
			if (comptimeItem.comptimeModulePath !== comptimeModule.path && fnReferences.length > 0) {
				const importInfo = comptimeModule.comptimeImports.values().find(v => !!v.comptimeSymbols.values().find(c => c.symbol === comptimeItem.symbol))
				if (!importInfo)
					throw new Error(":#");
				if (!addedImports[importInfo.importPath]) {
					addedImports[importInfo.importPath] = new Set<string>();
				}
				fnReferences.forEach(r => {
					if (!importInfo.otherImports.includes(r.name))
						addedImports[importInfo.importPath]!.add(r.name);
				});
			}
			return ast;
		} else if (comptimeItem.result["__COMPTIME_CONST_FN__"]) {
			console.log("const functions only implemented as tot level statements!");
		}

		return node;
	}
}

export type MacroFn = (ctx: Comptime.Context, ...args: Comptime.Expr<any>[]) => Comptime.Expr<any>;