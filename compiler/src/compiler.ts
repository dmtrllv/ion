import { dirname, join, resolve } from "node:path";
import { API, Checker, ParsedCommandLine, Program, ModuleResolver } from "typescript/sync";
import { disposable } from "./disposable.js";
import { AstTree } from "./ast/tree.js";
import { Package } from "./package.js";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolveComptimeSymbols } from "./comptime/symbols.js";
import { cached, resolveNodeModules } from "./utils.js";
import { ComptimeModuleTransformer } from "./comptime/transformer.js";
import { ComptimeManifest } from "./comptime/manifest.js";

export class Compiler {
	public static readonly load = (root: string) => {
		const api = new API();
		const pkg = Package.load(api, root);
		const config = api.parseConfigFile(resolve(root, "tsconfig.json"));
		const program = api.createProgram(config.fileNames, config.options, {});
		const nodeModulesPath = resolveNodeModules(root);
		if (!nodeModulesPath) {
			console.log(`Could not resolve nodeModulesPath at ${root}!`);
			api[Symbol.dispose]();
			return undefined;
		}
		return disposable(new Compiler(api, pkg, config, program, nodeModulesPath));
	}

	public readonly root: Package;
	public readonly config: ParsedCommandLine;
	public readonly api: API<false>;
	public readonly program: Program;
	public readonly checker: Checker;
	public readonly ast: AstTree;
	public readonly nodeModulesPath: string;
	public readonly packages: Map<string, Package>;

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
		this.packages = new Map<string, Package>();
		this.nodeModulesPath = nodeModulesPath;
		this.packages.set(rootPackage.path, rootPackage);
	}

	public createResolver(): ModuleResolver {
		return this.api.createModuleResolver(this.config.options);
	}

	public resolvePackage(path: string) {
		if (this.packages.has(path))
			return this.packages.get(path)!;
		const pkg = Package.load(this.api, path);
		this.packages.set(path, pkg);
		return pkg;
	}

	public resolvePackageFromModule(modulePath: string) {
		let packageRoot = dirname(modulePath);
		while (!existsSync(join(packageRoot, "package.json"))) {
			const parent = dirname(packageRoot);
			if (parent === packageRoot) {
				return undefined;
			}
			packageRoot = parent;
		}
		return this.resolvePackage(packageRoot);
	}

	public compile(options: { type: "app" | "lib" }) {
		if (options.type === "lib") {
			ComptimeManifest.create(this);
		}

		const transformer = new ComptimeModuleTransformer();
		for (const path of this.root.sourceFilePaths) {
			const module = this.ast.resolveModule(path);
			//console.log(module.path);
			//const macros = module.getMacroDeclarations();
			//const exports = module.exports;
			const source = transformer.transform(this, module);
			const comptimePath = module.path.replace(module.package.sourcePath, module.package.comptimePath).replace(/\.tsx?$/, ".js");
			mkdirSync(dirname(comptimePath), { recursive: true });
			writeFileSync(comptimePath, source, "utf-8");
			//console.log(module);


			//console.log(path);
			//console.log("macros:", macros.map(m => m.name));
			//console.log("exports:", exports);
		}
	}
}