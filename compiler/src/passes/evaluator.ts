
import * as ts from "typescript";
import { pathToFileURL } from "node:url";
import { Compiler } from "../compiler.js";
import { Module } from "../module.js";
import { Pass } from "./pass.js";
import { ModuleMap } from "./resolver.js";
import { TransformedModule } from "./transformer.js";

export type ComptimeCall = {
	readonly module: Module;
	readonly node: ts.CallExpression;
};

export class ComptimeEvaluator implements Pass<void, [ModuleMap, TransformedModule[]]> {
	public readonly results = new Map<ts.CallExpression, unknown>();

	public async run(
		compiler: Compiler,
		modules: ModuleMap,
		transformedModules: TransformedModule[],
	): Promise<void> {
		const runtimeModules = new Map<Module, Record<string, unknown>>();

		for (const transformed of transformedModules) {
			const runtimeModule = await import(
				pathToFileURL(transformed.path).href
			);

			runtimeModules.set(transformed.module, runtimeModule);
		}

		for (const transformed of transformedModules) {
			await this.evaluate(
				compiler,
				transformed,
				modules,
				runtimeModules,
			);
		}
	}

	private async evaluate(
		compiler: Compiler,
		transformedModule: TransformedModule,
		modules: ModuleMap,
		runtimeModules: Map<Module, Record<string, unknown>>,
	): Promise<void> {
		const calls = this.findCallSites(transformedModule.module);

		for (const call of calls) {
			const symbol = this.resolveCallSymbol(compiler, call);

			if (!symbol) {
				continue;
			}

			const declarationModule = this.findDeclarationModule(
				symbol,
				modules,
			);

			if (!declarationModule) {
				continue;
			}

			const declaration =
				declarationModule.getComptimeDeclaration(symbol);

			if (!declaration) {
				continue;
			}

			const name = declaration.statement.name;

			if (!ts.isIdentifier(name)) {
				continue;
			}

			const runtimeModule = runtimeModules.get(declarationModule);

			if (!runtimeModule) {
				throw new Error(
					`No generated runtime module for ${declarationModule.path}`,
				);
			}

			const exported = runtimeModule[name.text];

			if (typeof exported !== "function") {
				console.log(exported);
				throw new Error(
					`Comptime export "${name.text}" in "${declarationModule.path}" is not callable`,
				);
			}

			if (call.node.arguments.length !== 0) {
				throw new Error(
					`Comptime call arguments are not implemented yet: ${call.node.getText(call.module.sourceFile)}`,
				);
			}

			const result = await exported();

			this.results.set(call.node, result);

			console.log("Comptime evaluated:", {
				module: call.module.path,
				expression: call.node.getText(call.module.sourceFile),
				declaration: name.text,
				result,
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
