import assert from "node:assert";
import { Module } from "./module.js";
import { Package } from "./package.js";
import ts, { Program } from "typescript";
import { ComptimeSymbols, resolveComptimeSymbols } from "./comptime/symbols.js";
import { ComptimeType } from "./comptime/item.js";
import { ComptimeResolver } from "./comptime/resolver.js";
import { ComptimeTransformer } from "./comptime/transformer.js";
import { createComptimeManifest } from "./comptime/manifest.js";

export class Compiler {
	public readonly rootPackage: Package;
	public readonly program: Program;
	public readonly modules: Map<string, Module>;
	public readonly comptimeSymbols: ComptimeSymbols | undefined;
	public readonly comptimeResolver: ComptimeResolver;
	public readonly comptimeTransformer: ComptimeTransformer;

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
		this.comptimeTransformer = new ComptimeTransformer(this);
		this.modules = this.initModules();
	}

	private initModules() {
		const modules = new Map<string, Module>();
		if (!this.usesComptime)
			return modules;

		this.program.getRootFileNames().forEach(path => {
			const sourceFile = this.program.getSourceFile(path);
			assert.ok(sourceFile);
			modules.set(path, this.initModule(path, sourceFile));
		});
		return modules;
	}

	private initModule(path: string, sourceFile: ts.SourceFile) {
		const pkg = Package.fromModulePath(path);
		assert.ok(pkg);
		return new Module(this, sourceFile, pkg, path)
	}

	public async compile() {
		await this.comptimeTransformer.transformProgram();
		console.log(this.program.getRootFileNames())
		await createComptimeManifest(this)
	}

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

	public isRootPackage(pkg: Package) {
		return this.rootPackage === pkg;
	}
}

