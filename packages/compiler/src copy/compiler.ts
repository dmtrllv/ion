import ts from "typescript";
import { Package } from "./package.js";
import assert from "node:assert";
import { Module } from "./module.js";
import { ComptimeSymbols, ComptimeType, resolveComptimeSymbols } from "./comptime.js";
import { ComptimeModule } from "./comptime-module.js";
import { Evaluator } from "./evaluator.js";

export class Compiler {
	public readonly rootPackage: Package;
	public readonly program: ts.Program;
	public readonly modules: Map<string, Module> = new Map();
	public readonly comptimeSymbols: ComptimeSymbols;
	public readonly evaluator = new Evaluator();

	public get config() { return this.rootPackage.tsconfig; }

	public get typeChecker(): ts.TypeChecker { return this.program.getTypeChecker(); }

	public constructor(root: string) {
		this.rootPackage = Package.get(root);
		this.program = ts.createProgram({
			options: this.config.options,
			rootNames: this.config.fileNames
		});
		this.comptimeSymbols = resolveComptimeSymbols(this);
	}

	public async compile() {
		const modules = this.config.fileNames.map(fileName => {
			const source = this.program.getSourceFile(fileName);
			assert.ok(source, `Could not get source file for ${fileName}`);
			const module = new Module(this, this.rootPackage, source!);
			this.modules.set(fileName, module);
			return module;
		});
		const comptimeModules = modules.map(mod => new ComptimeModule(this, mod));
		await Promise.all(comptimeModules.map(mod => mod.load()))
		this.evaluator.evaluate(this, comptimeModules);
		await Promise.all(comptimeModules.map(c => c.getComptimeValue("two")));
	}

	public getComptimeTypeFromSymbol(symbol: ts.Symbol): ComptimeType | undefined {
		if (symbol.flags & ts.SymbolFlags.Alias) {
			symbol = this.typeChecker.getAliasedSymbol(symbol);
		}

		switch (symbol) {
			case this.comptimeSymbols.comptime:
				return "comptime";
			case this.comptimeSymbols.fn:
				return "comptime.fn";
			case this.comptimeSymbols.macro:
				return "comptime.macro";
			default:
				return undefined;
		}
	}
}
