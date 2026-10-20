import ts from "typescript";
import { ComptimeModule } from "./comptime-module.js";
import { Compiler } from "./compiler.js";
import assert from "node:assert";
import { createContext, toExpression } from "./comptime-context.js";
import { Comptime } from "@ion/comptime";
import { Package } from "./package.js";

declare namespace globalThis {
	let __IS_COMPTIME__: boolean;
}

globalThis.__IS_COMPTIME__ = true;

export class Evaluator {
	public evaluate(compiler: Compiler, comptimeModules: ComptimeModule[]) {
		//comptimeModules.forEach(mod => this.evaluateAndCompile(compiler, mod, comptimeModules));
		const emitResult = compiler.program.emit(
			undefined,
			undefined,
			undefined,
			false,
			{
				before: [this.transformer(compiler, comptimeModules)],
			},
		);

		if (emitResult.emitSkipped || emitResult.diagnostics.length > 0) {
			const diagnostics = ts.formatDiagnosticsWithColorAndContext(
				emitResult.diagnostics,
				{
					getCurrentDirectory: ts.sys.getCurrentDirectory,
					getCanonicalFileName: fileName => fileName,
					getNewLine: () => ts.sys.newLine,
				},
			);

			throw new Error(`TypeScript emit failed:\n${diagnostics}`);
		}

		console.log(emitResult.emittedFiles);
	}

	//private evaluateAndCompile(compiler: Compiler, comptimeModule: ComptimeModule, comptimeModules: ComptimeModule[]) {
	//	const result = ts.transform(comptimeModule.module.sourceFile, [this.transformer(compiler, comptimeModule, comptimeModules)]);
	//	try {
	//		const transformed = result.transformed[0]!;
	//		const transformedSource = ts.createPrinter({ removeComments: true }).printFile(transformed);
	//		const js = ts.transpileModule(transformedSource, {
	//			compilerOptions: {
	//				target: ts.ScriptTarget.ESNext,
	//				module: ts.ModuleKind.ESNext,
	//				removeComments: true,
	//				jsxImportSource: compiler.config.options.jsxImportSource!,
	//				jsx: ts.JsxEmit.ReactJSX,
	//				jsxFragmentFactory: compiler.config.options.jsxFragmentFactory!,
	//				jsxFactory: compiler.config.options.jsxFactory!,
	//			},
	//			fileName: comptimeModule.module.sourceFile.fileName,
	//		});
	//		mkdirSync(dirname(comptimeModule.module.buildPath), { recursive: true });
	//		writeFileSync(comptimeModule.module.buildPath, js.outputText, "utf-8");
	//	} catch (e) {
	//		console.warn(e);
	//	} finally {
	//		result.dispose();
	//	}
	//}

	private readonly transformer = (compiler: Compiler, comptimeModules: ComptimeModule[]): ts.TransformerFactory<ts.SourceFile> => (ctx) => {
		let comptimeModule: ComptimeModule;

		const addedImports: Record<string, Set<string>> = {};

		const visit: ts.Visitor = node => {
			if (ts.isCallExpression(node)) {
				return ts.visitEachChild(this.transformCall(compiler, node, comptimeModule, comptimeModules, addedImports), visit, ctx);
			}

			if (ts.isVariableStatement(node)) {
				const transformed = this.transformComptimeStmt(compiler, node, comptimeModule);

				if (!transformed)
					return undefined;

				return ts.visitEachChild(transformed, visit, ctx);
			}

			//if (ts.isIdentifier(node)) {
			//	return this.transformIdent(compiler, node, comptimeModule, comptimeModules);
			//}

			return ts.visitEachChild(node, visit, ctx);
		};

		return sourceFile => {
			comptimeModule = comptimeModules.find(c => c.module.path === sourceFile.fileName)!;
			if (!comptimeModule)
				throw new Error("Could not get comptime module");

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

				if (ts.isExportDeclaration(statement)) {
					const stmt = this.rewriteExport(compiler, statement, comptimeModule);
					statements.push(ts.visitNode(stmt, visit) as ts.Statement);
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

	private rewriteExport(compiler: Compiler, statement: ts.ExportDeclaration, comptimeModule: ComptimeModule): ts.Statement | undefined {
		if (!statement.moduleSpecifier || !statement.exportClause || !ts.isStringLiteral(statement.moduleSpecifier))
			return statement;

		if (ts.isNamespaceExport(statement.exportClause))
			return statement;

		const importPath = statement.moduleSpecifier.text;
		const result = ts.resolveModuleName(importPath, comptimeModule.module.sourceFile.fileName, compiler.config.options, ts.sys);
		const resolvedModule = result.resolvedModule;
		assert.ok(resolvedModule, `Could not resolve module path for import ${importPath}`);
		const path = resolvedModule.resolvedFileName;
		const isExternal = resolvedModule.isExternalLibraryImport || false;
		const pkg = isExternal ? Package.findFromSource(path) : comptimeModule.module.package;

		if (isExternal && !pkg.isComptime)
			return statement;

		const exportNames = new Set<string>();
		const originalNames = new Set(statement.exportClause.elements.map(element => element.propertyName?.text ?? element.name.text));

		if (isExternal) {
			const relativePath = pkg.getRelativeSourcePath(path);
			const exports = pkg.comptimeManifest?.exports?.[relativePath];

			if (!exports)
				return statement;

			for (const element of statement.exportClause.elements) {
				if (element.isTypeOnly)
					continue;

				const name = element.propertyName?.text ?? element.name.text;
				assert.ok(name);

				if (!exports[name]) {
					exportNames.add(name);
				} else if (exports[name] === "comptime") {
					throw new Error("TODO update reexport from external lib");
				}
			}
		} else {
			const targetModule = compiler.modules.get(path);
			assert.ok(targetModule, `Could not get local module at ${path}!`);

			for (const element of statement.exportClause.elements) {
				if (element.isTypeOnly)
					continue;

				const name = element.propertyName?.text ?? element.name.text;
				assert.ok(name);

				const comptimeItem = targetModule.comptimeDeclarations.get(name);
				if (!comptimeItem) {
					exportNames.add(name);
					continue;
				}

				let isMacro = comptimeItem.type === "comptime.macro";
				if (comptimeItem.type === "comptime" && "__COMPTIME_MACRO_FN__" in comptimeItem.result)
					isMacro = true;

				if (isMacro) {
					const references = this.resolveMacroFnReturnReferenceSymbol(compiler, comptimeItem.symbol);
					references.forEach(name => exportNames.add(name));
				} else {
					exportNames.add(name);
				}
			}
		}

		if (exportNames.size === 0)
			return undefined;

		const elements: ts.ExportSpecifier[] = [];

		for (const element of statement.exportClause.elements) {
			const name = element.propertyName?.text ?? element.name.text;
			if (exportNames.has(name))
				elements.push(element);
		}

		for (const name of exportNames) {
			if (!originalNames.has(name))
				elements.push(ts.factory.createExportSpecifier(false, undefined, ts.factory.createIdentifier(name)));
		}

		const originalElements = statement.exportClause.elements;
		if (elements.length === originalElements.length && elements.every((element, index) => element === originalElements[index]))
			return statement;

		const namedExports = ts.factory.updateNamedExports(statement.exportClause, elements);
		return ts.factory.updateExportDeclaration(statement, statement.modifiers, statement.isTypeOnly, namedExports, statement.moduleSpecifier, statement.attributes);
	}

	private resolveMacroFnReturnReferenceSymbol(compiler: Compiler, symbol: ts.Symbol): string[] {
		const stmt = symbol.valueDeclaration;
		if (!stmt || !ts.isVariableDeclaration(stmt) || !stmt.initializer || !ts.isCallExpression(stmt.initializer))
			return [];

		const checker = compiler.typeChecker;
		const references = new Set<string>();
		const aliases = new Map<ts.Symbol, ts.Expression>();
		const visited = new Set<ts.Symbol>();

		const resolveAlias = (symbol: ts.Symbol): ts.Expression | undefined => {
			if (visited.has(symbol))
				return undefined;

			visited.add(symbol);

			const initializer = aliases.get(symbol);
			if (!initializer)
				return undefined;

			if (ts.isIdentifier(initializer)) {
				const target = checker.getSymbolAtLocation(initializer);
				if (target && aliases.has(target))
					return resolveAlias(target);
			}

			return initializer;
		};

		const getSymbol = (node: ts.Node): ts.Symbol | undefined => {
			const symbol = checker.getSymbolAtLocation(node);
			if (!symbol?.flags)
				return symbol;
			return symbol?.flags && symbol?.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
		};

		const isSyntaxCall = (node: ts.CallExpression): boolean => {
			if (!ts.isPropertyAccessExpression(node.expression))
				return false;

			const callSymbol = getSymbol(node.expression.name);
			if (!callSymbol)
				return false;

			const receiver = node.expression.expression;
			if (ts.isPropertyAccessExpression(receiver) && receiver.name.text === "syntax") {
				const receiverSymbol = getSymbol(receiver.name);
				const ctxSymbol = getSymbol(receiver.expression);

				if (receiverSymbol && ctxSymbol)
					return true;
			}

			if (ts.isIdentifier(receiver)) {
				const receiverSymbol = getSymbol(receiver);
				const initializer = receiverSymbol ? resolveAlias(receiverSymbol) : undefined;

				if (initializer && ts.isPropertyAccessExpression(initializer) && initializer.name.text === "syntax")
					return true;
			}

			return false;
		};

		const collectAliases = (node: ts.Node): void => {
			if (ts.isVariableDeclaration(node) && node.initializer) {
				if (ts.isIdentifier(node.name)) {
					const declared = checker.getSymbolAtLocation(node.name);
					if (declared)
						aliases.set(declared, node.initializer);
				} else if (ts.isObjectBindingPattern(node.name)) {
					for (const element of node.name.elements) {
						if (element.dotDotDotToken || !ts.isIdentifier(element.name))
							continue;

						const propertyName = element.propertyName && ts.isIdentifier(element.propertyName) ? element.propertyName.text : element.name.text;
						const declared = checker.getSymbolAtLocation(element.name);
						if (!declared)
							continue;

						if (ts.isIdentifier(node.initializer) && propertyName === "syntax") {
							aliases.set(declared, ts.factory.createPropertyAccessExpression(node.initializer, propertyName));
						} else if (ts.isPropertyAccessExpression(node.initializer) && propertyName === "call") {
							aliases.set(declared, ts.factory.createPropertyAccessExpression(node.initializer, propertyName));
						}
					}
				}
			}

			ts.forEachChild(node, collectAliases);
		};

		collectAliases(stmt.initializer);

		const visit = (node: ts.Node): void => {
			if (ts.isCallExpression(node) && isSyntaxCall(node) && node.arguments.length > 0) {
				const arg = node.arguments[0];
				if (arg && ts.isIdentifier(arg))
					references.add(arg.text);
			}

			ts.forEachChild(node, visit);
		};

		visit(stmt.initializer);

		return [...references];
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
			//console.log(found);
			if (found) {
				const elements: ts.ImportSpecifier[] = [];
				for (const element of clause.namedBindings.elements) {
					if (element.isTypeOnly)
						continue;

					const name = element.propertyName?.text ?? element.name.text;
					const cs = found.comptimeSymbols.values().find(v => v.name === name);

					if (!cs) {
						elements.push(element);
						continue;
					}
					if (cs.type === "comptime.macro" || cs.type === "comptime.fn.decl") {
						continue;
					}

					if (cs.type === "comptime") {
						if (typeof cs.result === "function" && "__COMPTIME_MACRO_FN__" in cs.result)
							continue
					}

					//const val = comptimeModule.getComptimeValue(cs.name);
					//const isMacro = ;
					//console.log("remove macro");
					//if (!isMacro)
					elements.push(element);
				}

				const toAdd = addedImports[importName];

				if (toAdd) {
					for (const val of toAdd) {
						if (!elements.some(element => element.name.text === val))
							elements.push(ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier(val)));
					}
				}

				if (elements.length > 0) {
					const namedImports = ts.factory.updateNamedImports(clause.namedBindings, elements);
					const importClause = ts.factory.updateImportClause(clause, clause.phaseModifier, clause.name, namedImports);
					return ts.factory.updateImportDeclaration(node, node.modifiers, importClause, node.moduleSpecifier, node.attributes);
				}

				return undefined;
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

			if (s.type === "comptime.fn.decl" || s.type === "comptime.macro") {
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

	private transformCall(compiler: Compiler, node: ts.CallExpression, comptimeModule: ComptimeModule, _comptimeModules: ComptimeModule[], addedImports: Record<string, Set<string>>): ts.Node | undefined {
		if (!ts.isIdentifier(node.expression)) {
			return node;
		}

		let symbol = compiler.typeChecker.getSymbolAtLocation(node.expression);
		assert.ok(symbol);
		symbol = symbol.flags & ts.SymbolFlags.Alias ? compiler.typeChecker.getAliasedSymbol(symbol) : symbol;

		const comptimeItem = comptimeModule.comptimeSymbols.get(symbol);
		if (!comptimeItem)
			return node;

		if (comptimeItem.type === "comptime.fn") {
			if (!("result" in comptimeItem)) {

			} else {
				comptimeItem.result
				console.log("transform call", node.expression.text, comptimeItem.type, comptimeItem.result);
			}
		}

		if (comptimeItem.result && comptimeItem.result["__COMPTIME_MACRO_FN__"]) {
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
		} else if (comptimeItem.result?.["__COMPTIME_CONST_FN__"]) {
			console.log("const functions only implemented as tot level statements!");
		}

		return node;
	}
}

export type MacroFn = ((ctx: Comptime.Context, ...args: Comptime.Expr<any>[]) => Comptime.Expr<any>);