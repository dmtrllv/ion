//import { Compiler } from "./compiler.js";
//import ts, { SourceFile } from "typescript";
//import assert from "node:assert";
//import { isComptimeSymbol } from "./comptime/item.js";
//import { Module } from "./module.js";

//export class Import {
//	public readonly declaration: ts.ImportDeclaration;
//	public readonly importPath: string;
//	public readonly importedModule: Module;
//	public readonly symbols: ImportSymbol[] = [];
//	public readonly type: ImportType;

//	public constructor(compiler: Compiler, sourceFile: SourceFile, declaration: ts.ImportDeclaration) {
//		this.declaration = declaration;
//		this.importPath = (this.declaration.moduleSpecifier as ts.StringLiteral).text;
//		const importedModule = compiler.resolveModule(declaration, sourceFile);
//		assert.ok(importedModule);
//		this.importedModule = importedModule;

//		if (!this.declaration.importClause) {
//			this.type = ImportType.SideEffect;
//			return;
//		}

//		const { name, namedBindings } = this.declaration.importClause;
//		if (name && namedBindings) {
//			if (ts.isNamedImports(namedBindings)) {
//				this.type = ImportType.DefaultAndNamed;
//				this.addSymbol(compiler, name, this.declaration.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword);
//				namedBindings.elements.forEach(e => this.addSpecifier(compiler, e));
//				return;
//			} else if (ts.isNamespaceImport(namedBindings)) {
//				this.type = ImportType.DefaultAndNamespace;
//				this.addSymbol(compiler, namedBindings.name, this.declaration.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword);
//				this.addSymbol(compiler, name, this.declaration.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword);
//				return;
//			}
//		}

//		if (name) {
//			this.type = ImportType.Default;
//			this.addSymbol(compiler, name, this.declaration.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword);
//			return
//		} else if (namedBindings) {
//			if (ts.isNamedImports(namedBindings)) {
//				this.type = ImportType.Named;
//				namedBindings.elements.forEach(e => this.addSpecifier(compiler, e));
//				return;
//			} else if (ts.isNamespaceImport(namedBindings)) {
//				this.type = ImportType.Namespace;
//				this.addSymbol(compiler, namedBindings.name, this.declaration.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword);
//				return;
//			}
//		}

//		this.type = ImportType.SideEffect;
//	}

//	private addSpecifier(compiler: Compiler, ident: ts.ImportSpecifier) {
//		this.addSymbol(compiler, ident.name, ident.isTypeOnly, ident.propertyName)
//	}

//	private addSymbol(compiler: Compiler, ident: ts.Identifier, isTypeOnly: boolean, aliasName?: ts.ModuleExportName) {
//		let symbol = compiler.typeChecker.getSymbolAtLocation(ident);
//		assert.ok(symbol);
//		symbol = compiler.getAliasedSymbol(symbol);
//		const localSymbol = aliasName ? compiler.typeChecker.getSymbolAtLocation(aliasName) : symbol;
//		assert.ok(localSymbol);
//		this.symbols.push({
//			symbol,
//			localSymbol,
//			isComptime: isComptimeSymbol(symbol),
//			isTypeOnly
//		});
//	}
//}

//export type ImportSymbol = {
//	readonly symbol: ts.Symbol;
//	readonly localSymbol: ts.Symbol;
//	readonly isComptime: boolean;
//	readonly isTypeOnly: boolean;
//};

//export const ImportType = {
//	Default: 0,
//	Named: 1,
//	Namespace: 2,
//	SideEffect: 3,
//	DefaultAndNamed: 4,
//	DefaultAndNamespace: 5,
//} as const;

//export type ImportType = typeof ImportType[keyof typeof ImportType];
