
import * as ts from "typescript";
import { Compiler } from "../compiler.js";
import { Module } from "../module.js";
import { Pass } from "./pass.js";
import { ModuleMap } from "./resolver.js";
import { TransformedModule } from "./transformer.js";

export type ComptimeCall = {
	readonly module: Module;
	readonly node: ts.CallExpression;
};

export class ComptimeEvaluator
	implements Pass<void, [ModuleMap, TransformedModule[]]>
{
	public async run(
		compiler: Compiler,
		modules: ModuleMap,
		transformedModules: TransformedModule[],
	): Promise<void> {
		await Promise.all(
			transformedModules.map(transformedModule =>
				this.evaluate(compiler, transformedModule, modules)
			)
		);
	}

	private async evaluate(
		compiler: Compiler,
		transformedModule: TransformedModule,
		modules: ModuleMap,
	): Promise<void> {
		const calls = this.findCallSites(transformedModule.module);

		for (const call of calls) {
			const symbol = this.resolveCallSymbol(compiler, call);

			const declarationModule = symbol
				? this.findDeclarationModule(symbol, modules)
				: undefined;

			const declaration = symbol && declarationModule
				? declarationModule.getComptimeDeclaration(symbol)
				: undefined;

			console.log("Comptime call lookup:", {
				module: call.module.path,
				expression: call.node.expression.getText(call.module.sourceFile),
				symbol: symbol?.getName(),
				declarationModule: declarationModule?.path,
				comptimeType: declaration?.type,
			});
		}
	}

	private findCallSites(module: Module): ComptimeCall[] {
		const calls: ComptimeCall[] = [];

		const visit = (node: ts.Node): void => {
			if (ts.isCallExpression(node)) {
				calls.push({ module, node });
			}

			ts.forEachChild(node, visit);
		};

		visit(module.sourceFile);
		return calls;
	}

	private resolveCallSymbol(
		compiler: Compiler,
		call: ComptimeCall,
	): ts.Symbol | undefined {
		const symbol = compiler.typeChecker.getSymbolAtLocation(
			call.node.expression,
		);

		if (!symbol) {
			return undefined;
		}

		return (symbol.flags & ts.SymbolFlags.Alias) !== 0
			? compiler.typeChecker.getAliasedSymbol(symbol)
			: symbol;
	}

	private findDeclarationModule(
		symbol: ts.Symbol,
		modules: ModuleMap,
	): Module | undefined {
		for (const declaration of symbol.declarations ?? []) {
			const sourceFile = declaration.getSourceFile();

			for (const module of Object.values(modules)) {
				if (module.fullPath === sourceFile.fileName) {
					return module;
				}
			}
		}

		return undefined;
	}
}
