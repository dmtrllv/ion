import assert from "node:assert";
import { Module } from "./module.js";
import { Package } from "./package.js";
import ts, { Program } from "typescript";
import { ComptimeSymbols, resolveComptimeSymbols } from "./comptime/symbols.js";
import { ComptimeType } from "./comptime/item.js";
import { ComptimeResolver } from "./comptime/resolver.js";

export class Compiler {
	public readonly rootPackage: Package;
	public readonly program: Program;
	public readonly modules: Map<string, Module>;
	public readonly comptimeSymbols: ComptimeSymbols | undefined;
	public readonly comptimeResolver: ComptimeResolver;

	public get config() {
		assert.ok(this.rootPackage.tsConfig);
		return this.rootPackage.tsConfig;
	}

	/**
	 * if the `@ion/comptime` package does not exists, it is assumed that no dependency
	 * uses any comptime features and `compiler.comptimeSymbols` should be undefined
	 */
	public get usesComptime() {
		return this.comptimeSymbols !== undefined;
	}

	public get typeChecker(): ts.TypeChecker { return this.program.getTypeChecker(); }

	public constructor(root: string) {
		this.rootPackage = Package.get(root);
		this.program = ts.createProgram({ options: this.config.options, rootNames: this.config.fileNames });
		this.comptimeSymbols = resolveComptimeSymbols(this);
		this.comptimeResolver = new ComptimeResolver(this);
		this.modules = this.initModules();
	}

	private initModules() {
		const modules = new Map<string, Module>();
		if (!this.usesComptime)
			return modules;

		this.program.getSourceFiles().forEach(sourceFile => {
			const path = sourceFile.fileName;
			modules.set(path, this.initModule(path, sourceFile));
		});
		return modules;
	}

	private initModule(path: string, sourceFile: ts.SourceFile) {
		const pkg = Package.fromModulePath(path);
		return new Module(this, sourceFile, pkg, path)
	}

	//public getModule(path: string): Module {
	//	const cached = this.modules.get(path);
	//	if (cached)
	//		return cached;
	//	const sourceFile = this.program.getSourceFile(path);
	//	assert.ok(sourceFile);
	//	const mod = this.initModule(path, sourceFile);
	//	this.modules.set(path, mod);
	//	return mod;
	//}

	public async compile() {
		//this.modules.forEach(module => module.generateComptimeSource(this))
	}

	//public resolveModule(node: ts.ExportDeclaration | ts.ImportDeclaration, sourceFile: ts.SourceFile): Module | undefined {
	//	if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier))
	//		return undefined;

	//	const m = ts.resolveModuleName(node.moduleSpecifier.text, sourceFile.fileName, this.program.getCompilerOptions(), ts.sys).resolvedModule;
	//	if (!m)
	//		return undefined;

	//	return this.modules.get(m.resolvedFileName);
	//}

	public getAliasedSymbol(symbol: ts.Symbol) {
		if (symbol.flags & ts.SymbolFlags.Alias)
			symbol = this.typeChecker.getAliasedSymbol(symbol);
		return symbol
	}

	public getComptimeType(symbol: ts.Symbol, propertyName?: string): ComptimeType | undefined {
		symbol = this.getAliasedSymbol(symbol);

		if (symbol === this.comptimeSymbols?.comptime) {
			switch (propertyName) {
				case "fn": return "fn.decl";
				case "macro": return "macro.decl";
				default: return "decl";
			}
		}

		if (symbol === this.comptimeSymbols?.fn)
			return "fn.decl";
		if (symbol === this.comptimeSymbols?.macro)
			return "macro.decl";

		return undefined;
	}
}