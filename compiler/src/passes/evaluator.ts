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

type ComptimeFn = {
	readonly __ion_comptime_fn__?: (
		args: readonly ts.Expression[],
	) => unknown;
};

type RuntimeModule = Record<string, unknown>;

export class ComptimeEvaluator
	implements Pass<void, [ModuleMap, TransformedModule[]]> {
	public readonly results = new Map<ts.CallExpression, unknown>();

	public async run(
		compiler: Compiler,
		modules: ModuleMap,
		transformedModules: TransformedModule[],
	): Promise<void> {
		const runtimeModules = await this.loadRuntimeModules(
			transformedModules,
		);

		this.validateComptimeValues(modules, runtimeModules);

		for (const transformed of transformedModules) {
			await this.evaluate(
				compiler,
				transformed.module,
				modules,
				runtimeModules,
			);
		}
	}

	private async loadRuntimeModules(
		transformedModules: TransformedModule[],
	): Promise<Map<Module, RuntimeModule>> {
		const runtimeModules = new Map<Module, RuntimeModule>();

		for (const transformed of transformedModules) {
			const runtimeModule = (await import(
				pathToFileURL(transformed.path).href
			)) as RuntimeModule;

			runtimeModules.set(transformed.module, runtimeModule);
		}

		return runtimeModules;
	}

	private validateComptimeValues(
		modules: ModuleMap,
		runtimeModules: Map<Module, RuntimeModule>,
	): void {
		for (const module of Object.values(modules)) {
			const runtimeModule = runtimeModules.get(module);

			if (!runtimeModule) {
				continue;
			}

			for (const declaration of module.macroDeclarations) {
				if (declaration.type !== "comptime") {
					continue;
				}

				const name = declaration.statement.name;

				if (!ts.isIdentifier(name)) {
					continue;
				}

				const value = runtimeModule[name.text];

				if (this.isTypeScriptNode(value)) {
					throw new Error(
						`Comptime value "${name.text}" in "${module.path}" returned a TypeScript node. ` +
						"`comptime` must return a regular JavaScript value.",
					);
				}
			}
		}
	}

	private async evaluate(
		compiler: Compiler,
		module: Module,
		modules: ModuleMap,
		runtimeModules: Map<Module, RuntimeModule>,
	): Promise<void> {
		for (const call of this.findCallSites(module)) {
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
					`No generated runtime module for "${declarationModule.path}".`,
				);
			}

			const exported = runtimeModule[name.text];

			if (!this.isComptimeFn(exported)) {
				continue;
			}

			const result: any = await exported.__ion_comptime_fn__!(
				call.node.arguments,
			);

			if (!ts.isExpression(result)) {
				throw new Error(
					`Comptime function "${name.text}" in "${declarationModule.path}" ` +
					"must return a TypeScript expression.",
				);
			}

			this.results.set(call.node, result);

			console.log("Comptime evaluated:", {
				module: module.path,
				expression: call.node.getText(module.sourceFile),
				declaration: name.text,
				result: ts.createPrinter().printNode(
					ts.EmitHint.Expression,
					result,
					module.sourceFile,
				),
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

	private isComptimeFn(value: unknown): value is ComptimeFn & Function {
		return (
			typeof value === "function" &&
			typeof (value as ComptimeFn).__ion_comptime_fn__ === "function"
		);
	}

	private isTypeScriptNode(value: unknown): value is ts.Node {
		return (
			typeof value === "object" &&
			value !== null &&
			"kind" in value &&
			typeof (value as ts.Node).kind === "number" &&
			typeof (value as ts.Node).getSourceFile === "function"
		);
	}
}