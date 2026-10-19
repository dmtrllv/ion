import * as ts from "typescript";
import { Module } from "./module.js";
import { mkdirSync, writeFileSync } from "fs";
import { Compiler } from "./compiler.js";
import { dirname, relative } from "path";
import { Package } from "./package.js";

export class ComptimeModule {
	public readonly module: Module;
	public readonly path: string;
	public readonly buildId: number;
	public readonly compiler: Compiler;

	public readonly comptimeMacros: Map<string, { declaration: ts.VariableDeclaration, symbol: ts.Symbol }> = new Map();
	public readonly comptimeDeclarations: Map<string, { id: string, declaration: ts.VariableDeclaration, symbol: ts.Symbol }> = new Map();

	public constructor(buildId: number, compiler: Compiler, module: Module, path: string) {
		this.buildId = buildId;
		this.compiler = compiler;
		this.module = module;
		this.path = path;
	}

	public compile() {
		const result = ts.transform(this.module.source, [this.transformer]);

		try {
			const transformed = result.transformed[0]!;
			const transformedSource = ts.createPrinter({ removeComments: true }).printFile(transformed);
			const js = ts.transpileModule(transformedSource, {
				compilerOptions: {
					target: ts.ScriptTarget.ESNext,
					module: ts.ModuleKind.ESNext,
					removeComments: true,
					jsxImportSource: this.compiler.config.options.jsxImportSource!,
					jsx: ts.JsxEmit.ReactJSX,
					jsxFragmentFactory: this.compiler.config.options.jsxFragmentFactory!,
					jsxFactory: this.compiler.config.options.jsxFactory!,
				},
				fileName: this.module.source.fileName,
			});
			mkdirSync(dirname(this.path), { recursive: true });
			writeFileSync(this.path, js.outputText, "utf-8");
		} catch (e) {
			console.warn(e);
		} finally {
			result.dispose();
		}
	}

	private readonly transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
		const visit: ts.Visitor = node => {
			if (ts.isImportDeclaration(node)) {
				return this.rewriteImport(node);
			} else if (ts.isVariableStatement(node)) {
				return this.parseComptime(node);
			} else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
				return this.rewriteExport(node);
			} else if (ts.isCallExpression(node)) {
				return this.parseComptimeCall(node);
			} else {
				//return node;
				return ts.visitEachChild(node, visit, context);
			}
		};

		return sourceFile => ts.visitNode(sourceFile, visit) as ts.SourceFile;
	}

	private readonly parseComptimeCall = (node: ts.CallExpression): ts.Node | undefined => {
		if (ts.isIdentifier(node.expression)) {
			//console.log(node.expression.text)
		}
		return node;
	}

	private readonly rewriteExport = (node: ts.ExportDeclaration): ts.Node | undefined => {
		const clause = node.exportClause;

		if (!clause)
			return node;

		const path = (node.moduleSpecifier as ts.StringLiteral).text;

		if (path === "@ion/comptime")
			return node;

		const result = ts.resolveModuleName(path, this.module.source.fileName, this.compiler.config.options, ts.sys);
		if (!result.resolvedModule) {
			throw new Error(`Could not resolve import path for ${path}!`);
		}
		const pkg = Package.fromModulePath(result.resolvedModule.resolvedFileName);
		let ctp: string;
		if (result.resolvedModule.isExternalLibraryImport) {
			let relPath = pkg.getRealtiveSourcePathFromTyping(result.resolvedModule.resolvedFileName);
			ctp = pkg.getComptimePath(relPath);
			this.compiler.root.path
			const foundExport = this.module.exports.find(e => {
				return e.comptimePath === ctp;
			});
			ctp = relative(dirname(this.module.path), ctp);
			if (!foundExport || !foundExport.isExternal)
				return node;

		} else {
			ctp = pkg.getComptimePath(result.resolvedModule.resolvedFileName)
		}

		return ts.factory.updateExportDeclaration(
			node,
			node.modifiers,
			false,
			node.exportClause,
			ts.factory.createStringLiteral(ctp + `?id=${this.buildId}`),
			node.attributes,
		);
	}

	private readonly rewriteImport = (node: ts.ImportDeclaration): ts.VisitResult<ts.Node | undefined> => {
		const clause = node.importClause;

		if (!clause)
			return node;
		const path = (node.moduleSpecifier as ts.StringLiteral).text;

		if (path === "@ion/comptime")
			return node;

		const foundImport = this.module.imports.find(i => i.path === path);

		if (!foundImport)
			throw new Error(`Could not find import for ${path}!`);

		if (!foundImport.isExternal)
			return node;

		return ts.factory.updateImportDeclaration(
			node,
			node.modifiers,
			node.importClause,
			ts.factory.createStringLiteral(relative(dirname(this.module.path), foundImport.comptimePath) + `?id=${this.buildId}`),
			node.attributes,
		);
	}

	private readonly parseComptime = (node: ts.VariableStatement): ts.VisitResult<ts.Node | undefined> => {
		let isComptime = false;
		const declarations: ts.VariableDeclaration[] = [];

		for (const declaration of node.declarationList.declarations) {
			if (ts.isIdentifier(declaration.name) && declaration.initializer) {
				const symbol = this.module.checker.getSymbolAtLocation(declaration.name);

				if (!symbol)
					throw new Error(`Could not get symbol for export ${declaration.name.text}`);

				const declSymbol = symbol.flags & ts.SymbolFlags.Alias ? this.module.checker.getAliasedSymbol(symbol) : symbol;

				const comptimeType = this.module.getComptimeType(symbol);

				if (comptimeType === "comptime.macro") {
					isComptime = true;
					this.comptimeMacros.set(declaration.name.text, { declaration, symbol: declSymbol });
				} else if (comptimeType === "comptime" && ts.isCallExpression(declaration.initializer)) {
					isComptime = true;

					const id = this.compiler.comptimeResults.reserveComptimeResult(this.compiler.root.json.name!, declaration.initializer);
					this.comptimeDeclarations.set(declaration.name.text, { id, declaration, symbol: declSymbol });

					const call = declaration.initializer;
					const initializer = ts.factory.updateCallExpression(call,call.expression,call.typeArguments,[...call.arguments, ts.factory.createStringLiteral(id)]);
					declarations.push(ts.factory.updateVariableDeclaration(declaration, declaration.name, declaration.exclamationToken, declaration.type, initializer));
				} else {
					declarations.push(declaration);
				}
			} else {
				declarations.push(declaration);
			}
		}

		if (isComptime) {
			const modifiers = node.modifiers ? [...node.modifiers] : [];
			if (!modifiers.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
				modifiers.unshift(ts.factory.createModifier(ts.SyntaxKind.ExportKeyword));
			}

			const declarationList = ts.factory.updateVariableDeclarationList(
				node.declarationList,
				declarations,
			);

			return ts.factory.updateVariableStatement(node, modifiers, declarationList);
		}

		return node;
	}
}