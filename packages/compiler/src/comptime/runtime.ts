import { Context, createContext, SourceTextModule, SyntheticModule, Module } from "node:vm";
import { Compiler } from "../compiler.js";
import { ComptimeModule } from "./transformer.js";
import { isNodeBuiltinModule } from "../utils.js";
import { dirname, resolve } from "node:path";
import { readFile } from "node:fs/promises";

export class ComptimeRuntime {
	private readonly context: Context;
	private readonly modules = new Map<string, SourceTextModule>();
	private readonly syntheticModules = new Map<string, SyntheticModule>();
	private readonly compiler: Compiler;
	private readonly comptimeModules: Map<string, ComptimeModule>;

	public constructor(compiler: Compiler, modules: Map<string, ComptimeModule>) {
		this.compiler = compiler;
		this.comptimeModules = modules;
		this.context = createContext({ console });
	}

	public async load(): Promise<void> {
		const modules = [...this.comptimeModules.values()].map(m => {
			const module = new SourceTextModule(m.source, {
				context: this.context,
				identifier: m.comptimePath,
				initializeImportMeta: (meta, module) => {
					meta.url = module.identifier;
				},
			});

			this.modules.set(m.comptimePath, module);
			return module;
		});

		for (const module of modules) {
			if (module.status === "unlinked")
				await module.link(this.resolve);
		}
	}

	private async resolveBuiltin(module: string): Promise<Module> {
		if(this.syntheticModules.has(module))
			return this.syntheticModules.get(module)!;

		const builtin = await import(module);
		const names = Object.keys(builtin);

		const mod = new SyntheticModule(names, function () {
			for (const name of names)
				this.setExport(name, builtin[name]);
		}, { context: this.context, identifier: module });
		this.syntheticModules.set(module, mod);
		return mod;
	}

	private readonly resolve = async (specifier: string, referencingModule: Module): Promise<Module> => {
		if (isNodeBuiltinModule(specifier) || specifier === "typescript" || specifier.startsWith("typescript/") || specifier === "@ion/comptime")
			return this.resolveBuiltin(specifier);

		const id = await this.resolveId(specifier, referencingModule.identifier);

		const cached = this.modules.get(id);
		if (cached)
			return cached;

		const source = await this.loadSource(id);
		const module = new SourceTextModule(source, {
			context: this.context,
			identifier: id,
			initializeImportMeta: (meta, module) => {
				meta.url = module.identifier;
			},
		});

		this.modules.set(id, module);
		return module;
	}

	private readonly resolveId = async (specifier: string, importer: string): Promise<string> => {
		return resolve(dirname(importer), specifier);

		//throw new Error(`Cannot resolve ${path} "${specifier}" from "${importer}"`);
	}

	private readonly loadSource = (id: string): Promise<string> => {
		return readFile(id, "utf-8");
	}
}