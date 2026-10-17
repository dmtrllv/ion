import * as ts from "typescript";
import { pathToFileURL } from "node:url";
import { Compiler } from "../compiler.js";
import { Module } from "../module.js";
import { Pass } from "./pass.js";
import { ModuleMap } from "./resolver.js";
import { TransformedModule } from "./transformer.js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type ComptimeCall = {
	readonly module: Module;
	readonly node: ts.CallExpression;
};

export type ComptimeEvaluation = {
	readonly results: Map<ts.CallExpression, ts.Expression>;
	readonly comptimeImports: Map<ts.ImportDeclaration, Set<string>>;
	readonly comptimeDeclarations: Set<ts.VariableDeclaration>;
};

type ComptimeFn = {
	readonly __ion_comptime_fn__?: (args: readonly ts.Expression[]) => unknown;
};

type RuntimeModule = Record<string, unknown>;

type ComptimeManifestExport = {
	readonly kind: string;
	readonly module: string;
	readonly name: string;
	readonly source?: string;
};

type ComptimeManifest = {
	readonly version: number;
	readonly exports: Record<string, ComptimeManifestExport>;
};

type ExternalComptimeFunction = {
	readonly packageRoot: string;
	readonly entry: ComptimeManifestExport;
};

export class ComptimeEvaluator implements Pass<ComptimeEvaluation, [ModuleMap, TransformedModule[]]> {
	private readonly externalRuntimeModules = new Map<string, Promise<RuntimeModule>>();

	public async run(
		compiler: Compiler,
		modules: ModuleMap,
		transformedModules: TransformedModule[],
	): Promise<ComptimeEvaluation> {
		const runtimeModules = await this.loadRuntimeModules(
			transformedModules,
		);
		const results = new Map<ts.CallExpression, ts.Expression>();
		const comptimeImports = this.findComptimeImports(
			compiler,
			modules,
		);

		this.validateComptimeValues(modules, runtimeModules);

		const comptimeDeclarations = new Set<ts.VariableDeclaration>();

		for (const module of Object.values(modules)) {
			const runtimeModule = runtimeModules.get(module);

			for (const declaration of module.macroDeclarations) {
				if (declaration.type === "comptime.fn") {
					comptimeDeclarations.add(declaration.statement);
					continue;
				}

				if (declaration.type !== "comptime" || !runtimeModule) {
					continue;
				}

				const name = declaration.statement.name;

				if (
					ts.isIdentifier(name) &&
					this.isComptimeFn(runtimeModule[name.text])
				) {
					comptimeDeclarations.add(declaration.statement);
				}
			}
		}

		for (const transformed of transformedModules) {
			await this.evaluate(
				compiler,
				transformed.module,
				modules,
				runtimeModules,
				results,
			);
		}

		return { results, comptimeImports, comptimeDeclarations };
	}

	private findComptimeImports(
		compiler: Compiler,
		modules: ModuleMap,
	): Map<ts.ImportDeclaration, Set<string>> {
		const comptimeImports = new Map<
			ts.ImportDeclaration,
			Set<string>
		>();

		for (const module of Object.values(modules)) {
			for (const statement of module.sourceFile.statements) {
				if (
					!ts.isImportDeclaration(statement) ||
					!statement.importClause ||
					statement.importClause.isTypeOnly
				) {
					continue;
				}

				const clause = statement.importClause;
				const names = new Set<string>();

				if (clause.name) {
					const symbol = compiler.typeChecker.getSymbolAtLocation(
						clause.name,
					);

					if (
						symbol &&
						this.isComptimeFunctionSymbol(
							compiler,
							symbol,
							modules,
						)
					) {
						names.add(clause.name.text);
					}
				}

				const bindings = clause.namedBindings;

				if (bindings && ts.isNamedImports(bindings)) {
					for (const element of bindings.elements) {
						if (element.isTypeOnly) {
							continue;
						}

						const symbol = compiler.typeChecker.getSymbolAtLocation(
							element.name,
						);

						if (
							symbol &&
							this.isComptimeFunctionSymbol(
								compiler,
								symbol,
								modules,
							)
						) {
							names.add(element.name.text);
						}
					}
				}

				if (names.size > 0) {
					comptimeImports.set(statement, names);
				}
			}
		}

		return comptimeImports;
	}

	private isComptimeFunctionSymbol(
		compiler: Compiler,
		symbol: ts.Symbol,
		modules: ModuleMap,
	): boolean {
		let target = symbol;

		while ((target.flags & ts.SymbolFlags.Alias) !== 0) {
			const resolved = compiler.typeChecker.getAliasedSymbol(target);

			if (resolved === target) {
				break;
			}

			target = resolved;
		}

		const declarationModule = this.findDeclarationModule(
			target,
			modules,
		);

		if (declarationModule) {
			return (
				declarationModule.getComptimeDeclaration(target)?.type ===
				"comptime.fn"
			);
		}

		return this.findExternalComptimeFunction(target) !== undefined;
	}

	private findExternalComptimeFunction(
		symbol: ts.Symbol,
	): ExternalComptimeFunction | undefined {

		const declaration = symbol.valueDeclaration ??
			symbol.declarations?.[0];

		if (!declaration) {
			return undefined;
		}

		const declarationSourceFile = declaration.getSourceFile();
		// @ts-expect-error
		const isDeclarationFile = declarationSourceFile.isDeclarationFile;

		const sourcePath = resolve(declarationSourceFile.fileName);
		let directory = dirname(sourcePath);

		while (true) {
			try {
				readFileSync(resolve(directory, "package.json"), "utf-8");

				const manifest = JSON.parse(
					readFileSync(
						resolve(directory, "comptime.manifest.json"),
						"utf-8",
					),
				) as ComptimeManifest;

				// @ts-expect-error
				const sourceRelativePath = sourcePath
					.slice(directory.length + 1)
					.replace(/\\/g, "/");

				const entry = Object.values(manifest.exports).find(item =>
					item.kind === "comptime.fn" &&
					item.name === symbol.getName()
				);

				return entry
					? { packageRoot: directory, entry }
					: undefined;
			} catch (error) {
				if (
					!(error instanceof Error) ||
					!("code" in error) ||
					(error.code !== "ENOENT" && error.code !== "ENOTDIR")
				) {
					throw error;
				}
			}

			const parent = dirname(directory);

			if (parent === directory) {
				return undefined;
			}

			directory = parent;
		}
	}

	private async loadExternalRuntimeModule(
		path: string,
	): Promise<RuntimeModule> {
		let pending = this.externalRuntimeModules.get(path);

		if (!pending) {
			pending = import(pathToFileURL(path).href) as Promise<RuntimeModule>;
			this.externalRuntimeModules.set(path, pending);
		}

		return pending;
	}

	private async loadRuntimeModules(transformedModules: TransformedModule[]): Promise<Map<Module, RuntimeModule>> {
		const runtimeModules = new Map<Module, RuntimeModule>();

		for (const transformed of transformedModules) {
			const runtimeModule = (await import(
				pathToFileURL(transformed.path).href
			)) as RuntimeModule;

			runtimeModules.set(transformed.module, runtimeModule);
		}

		return runtimeModules;
	}

	private validateComptimeValues(modules: ModuleMap, runtimeModules: Map<Module, RuntimeModule>): void {
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
					throw new Error(`Comptime value "${name.text}" in "${module.path}" returned a TypeScript node. comptime must return a regular JavaScript value.`);
				}
			}
		}
	}

	private async evaluate(
		compiler: Compiler,
		module: Module,
		modules: ModuleMap,
		runtimeModules: Map<Module, RuntimeModule>,
		results: Map<ts.CallExpression, ts.Expression>,
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

			let name: string;
			let runtimeModule: RuntimeModule;
			let modulePath: string;

			if (declarationModule) {
				const declaration =
					declarationModule.getComptimeDeclaration(symbol);

				if (!declaration || declaration.type !== "comptime.fn") {
					continue;
				}

				if (!ts.isIdentifier(declaration.statement.name)) {
					continue;
				}

				name = declaration.statement.name.text;
				modulePath = declarationModule.path;

				const localRuntimeModule = runtimeModules.get(
					declarationModule,
				);

				if (!localRuntimeModule) {
					throw new Error(
						`No generated runtime module for "${modulePath}".`,
					);
				}

				runtimeModule = localRuntimeModule;
			} else {
				const external = this.findExternalComptimeFunction(symbol);

				if (!external) {
					continue;
				}

				name = external.entry.name;
				modulePath = resolve(
					external.packageRoot,
					external.entry.module,
				);

				runtimeModule = await this.loadExternalRuntimeModule(
					modulePath,
				);
			}

			const exported = runtimeModule[name];

			if (!this.isComptimeFn(exported)) {
				throw new Error(
					`Manifest entry "${name}" in "${modulePath}" does not ` +
					`export a valid comptime function.`,
				);
			}

			const result: any = await exported.__ion_comptime_fn__!(
				call.node.arguments,
			);

			if (!ts.isExpression(result)) {
				throw new Error(
					`Comptime function "${name}" in "${modulePath}" ` +
					`must return a TypeScript expression.`,
				);
			}

			results.set(call.node, result);
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