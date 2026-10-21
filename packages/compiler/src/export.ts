//import { Compiler } from "./compiler.js";
//import ts, { SourceFile } from "typescript";
//import assert from "node:assert";
//import { Module } from "./module.js";

//export class Export {
//	public readonly declaration: ts.ExportDeclaration;
//	public readonly fromPath: string;
//	public readonly fromModule: Module;
//	public readonly symbols: ExportSymbol[] = [];
//	public readonly type: ExportType;

//	public constructor(compiler: Compiler, sourceFile: SourceFile, declaration: ts.ExportDeclaration) {
//		this.declaration = declaration;
//		assert.ok(declaration.moduleSpecifier && ts.isStringLiteral(declaration.moduleSpecifier));
//		this.fromPath = declaration.moduleSpecifier.text;
//		const fromModule = compiler.resolveModule(declaration, sourceFile);
//		assert.ok(fromModule);
//		this.fromModule = fromModule;

//		if (!declaration.exportClause) {
//			this.type = ExportType.Wildcard;
//		} else if (ts.isNamespaceExport(declaration.exportClause)) {
//			this.type = ExportType.Namespace;
//			const symbol = compiler.typeChecker.getSymbolAtLocation(declaration.exportClause.name);
//			assert.ok(symbol);
//			this.symbols.push({ symbol: compiler.getAliasedSymbol(symbol), exportedSymbol: symbol, isTypeOnly: declaration.isTypeOnly });
//		} else if (ts.isNamedExports(declaration.exportClause)) {
//			this.type = ExportType.Named;
//			declaration.exportClause.elements.forEach(specifier => {
//				const symbol = compiler.typeChecker.getSymbolAtLocation(specifier.propertyName ?? specifier.name);
//				const localSymbol = compiler.typeChecker.getSymbolAtLocation(specifier.name);
//				assert.ok(symbol);
//				assert.ok(localSymbol);
//				this.symbols.push({
//					symbol: compiler.getAliasedSymbol(symbol),
//					exportedSymbol: localSymbol,
//					isTypeOnly: declaration.isTypeOnly || specifier.isTypeOnly
//				});
//			});
//		} else {
//			throw new Error(`Unknown re-export\nsource: ${declaration.getText()}`);
//		}
//	}
//}

//export type ExportSymbol = {
//	readonly symbol: ts.Symbol;
//	readonly exportedSymbol: ts.Symbol;
//	readonly isTypeOnly: boolean;
//};

//export const ExportType = {
//	Wildcard: 0,
//	Named: 1,
//	Namespace: 2,
//} as const;

//export type ExportType = typeof ExportType[keyof typeof ExportType];
