import * as ts from "typescript";
import { ComptimeModule } from "./comptime-module.js";
import { Comptime } from "@ion/comptime";
import { createContext } from "./comptime-context.js";
import { Compiler } from "./compiler.js";

declare namespace globalThis {
	let __NEXT_COMPTIME_CONTEXT__: (id: string) => Comptime.Context & { setResult: (id: string, value: any) => void };
}

export class Evaluator {
	public static readonly evaluate = async (buildId: number, compiler: Compiler, modules: ComptimeModule[]): Promise<EvaluationResult[]> => {
		const runtimeModules: RuntimeModule[] = [];

		for (const m of modules) {
			runtimeModules.push(new RuntimeModule(m));
		}

		//for (const m of runtimeModules) {

		//}

		globalThis.__NEXT_COMPTIME_CONTEXT__ = () => Object.assign(createContext(), {
			setResult(id: string, value: any) {
				if (compiler.comptimeResults.results[id])
					compiler.comptimeResults.results[id]!.result = value;
			}
		});

		await Promise.all(runtimeModules.map(r => r.load(r.comptimeModule.path, buildId)));

		const results = runtimeModules.map(m => this.evaluateComptimeCalls(compiler, runtimeModules, m));
		//console.log(compiler.comptimeResults.results);
		return results;
	}

	private static readonly evaluateComptimeCalls = (compiler: Compiler, runtimeModules: RuntimeModule[], mod: RuntimeModule): EvaluationResult => {
		const emitResult = compiler.program.emit(undefined, undefined, undefined, false, {
			before: [this.transformer(compiler, runtimeModules, mod)],
		});

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
		return {
			comptimeModule: mod.comptimeModule
		}
	}

	private static transformer = (compiler: Compiler, runtimeModules: RuntimeModule[], mod: RuntimeModule): ts.TransformerFactory<ts.SourceFile> => ctx => {
		const macros: Map<ts.Symbol, MacroFn> = new Map();
		//const comptimes: Map<ts.Symbol, any> = new Map();
		const checker = compiler.program.getTypeChecker();
		console.log(mod.macroDeclarations);
		//mod.comptimeModule.module.imports.forEach(i => {
		//	if (i.path === "@ion/comptime")
		//		return;

		//	i.symbols.forEach(symbol => {
		//		if(symbol.isComptime) {
		//			console.log(symbol.localSymbol.name);
		//		}
		//	});

		//	//const importedMod = runtimeModules.find(m => {
		//	//	console.log(m.comptimeModule.module.path, i.modulePath);
		//	//	return i.modulePath === m.comptimeModule.module.path;
		//	//});

		//	//if (!importedMod)
		//	//	throw new Error(`Could not find runtime module for ${i.modulePath}`);

		//	//i.symbols.forEach(s => {
		//	//	const m = importedMod.macros[s.sourceSymbol.name];
		//	//	if (!m)
		//	//		throw new Error(`Could not get imported macro ${s.localSymbol.name} at ${mod.comptimeModule.path}!`);

		//	//	macros.set(s.localSymbol, m.fn);
		//	//});
		//});

		console.log(macros);

		const visit: ts.Visitor = node => {
			if (ts.isCallExpression(node)) {
				if (ts.isIdentifier(node.expression)) {
					const symbol = checker.getSymbolAtLocation(node.expression);
					if (symbol) {
						//console.log(symbol.name)
						//const m = macros.get(symbol);
						//if (m) {
						//	console.log("replace macro ast", symbol.name);
						//	return m(createContext(node));
						//}
					}
				}
			}
			return ts.visitEachChild(node, visit, ctx);
		};

		return sourceFile => ts.visitNode(sourceFile, visit) as ts.SourceFile;
	}
}

export type MacroFn = (ctx: Comptime.Context, ...args: Comptime.Expr<any>[]) => Comptime.Expr<any>;

export class RuntimeModule {
	public runtimeModule!: NodeJS.Module;
	public readonly comptimeModule: ComptimeModule;
	public readonly macroDeclarations: Record<string, { fn: MacroFn, symbol: ts.Symbol }>;
	public readonly comptimeDeclarations: Record<string, { symbol: ts.Symbol }>;

	public constructor(comptimeModule: ComptimeModule) {
		this.comptimeModule = comptimeModule;
		this.macroDeclarations = {};
		this.comptimeDeclarations = {};
		for (const [name, node] of comptimeModule.comptimeMacros) {
			this.macroDeclarations[name] = {
				fn: this.runtimeModule.exports[name]?.["__ion_macro__"],
				symbol: node.symbol
			};
		}

		for (const [name, node] of comptimeModule.comptimeDeclarations) {
			if (node.isMacroOrConstFn) {
				this.macroDeclarations[name] = {
					fn: this.runtimeModule.exports[name]?.["__ion_macro__"],
					symbol: node.symbol
				};
			}
			this.comptimeDeclarations[name] = {
				symbol: node.symbol
			};
		}
	}

	public readonly callMacro = (name: string, node: ts.CallExpression): ts.Expression => {
		const macro = this.macroDeclarations[name];
		if (!macro)
			throw new Error(`Could not find macro with name ${name} in module ${this.runtimeModule.path}`);
		return macro.fn(createContext(node), ...node.arguments as any);
	}

	public async load(path: string, buildId: number) {
		//console.log("load runtime mod", path);
		this.runtimeModule = await import(`file://${path}?id=${buildId}`);
	}
}

export type EvaluationResult = {
	readonly comptimeModule: ComptimeModule;
}