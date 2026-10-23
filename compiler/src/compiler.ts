import { dirname, join, resolve } from "node:path";
import { API, Checker, ParsedCommandLine, Program } from "typescript/async";
import { asyncDisposable } from "./disposable.js";
import { AstTree } from "./ast/tree.js";
import { Package } from "./package.js";
import { Module } from "./ast/module.js";
import { existsSync } from "node:fs";
import { resolveComptimeSymbols } from "./comptime/symbols.js";
import { cached, resolveNodeModules } from "./utils.js";

export class Compiler {
	public static readonly load = async (root: string) => {
		const api = new API();
		const pkg = await Package.load(api, root);
		const config = await api.parseConfigFile(resolve(root, "tsconfig.json"));
		const program = await api.createProgram(config.fileNames, config.options, {});
		const nodeModulesPath = resolveNodeModules(root);
		if (!nodeModulesPath) {
			console.log(`Could not resolve nodeModulesPath at ${root}!`);
			await api[Symbol.asyncDispose]();
			return undefined;
		}
		return asyncDisposable(new Compiler(api, pkg, config, program, nodeModulesPath));
	}

	public readonly root: Package;
	public readonly config: ParsedCommandLine;
	public readonly api: API<false>;
	public readonly program: Program;
	public readonly checker: Checker;
	public readonly ast: AstTree;
	public readonly nodeModulesPath: string;
	public readonly packages: Map<string, Promise<Package>>;

	@cached
	public getComptimeSymbols() {
		return resolveComptimeSymbols(this);
	}

	private constructor(api: API, rootPackage: Package, config: ParsedCommandLine, program: Program, nodeModulesPath: string) {
		this.api = api;
		this.root = rootPackage;
		this.config = config;
		this.program = program;
		this.checker = program.getProject().checker;
		this.ast = new AstTree(this);
		this.packages = new Map<string, Promise<Package>>();
		this.nodeModulesPath = nodeModulesPath;
		this.packages.set(rootPackage.path, Promise.resolve(rootPackage));
	}

	public async resolvePackage(path: string) {
		if (this.packages.has(path))
			return this.packages.get(path)!;
		const pkg = Package.load(this.api, path);
		this.packages.set(path, pkg);
		return pkg;
	}

	public async resolvePackageFromModule(module: Module) {
		let packageRoot = dirname(module.path);
		while (!existsSync(join(packageRoot, "package.json"))) {
			const parent = dirname(packageRoot);
			if (parent === packageRoot) {
				return undefined;
			}
			packageRoot = parent;
		}
		return this.resolvePackage(packageRoot);
	}

	public async compile() {
		for (const path of this.root.sourceFilePaths) {
			const module = await this.ast.resolveModule(path);
			const macros = await module.getMacroDeclarations();
			const exports = await module.exports;

			await console.log(module);

			//console.log(path);
			//console.log("macros:", macros.map(m => m.name));
			//console.log("exports:", exports);
		}
	}
}