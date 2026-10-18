import ts from "typescript";
import { ComptimeManifest, Package } from "./package.js";
import { Module } from "./module.js";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

export class Compiler {
	public readonly root: Package;
	public readonly config: ts.ParsedCommandLine;
	public readonly program: ts.Program;
	public readonly modules: Map<string, Module> = new Map();

	public constructor(root: Package) {
		this.root = root;
		this.config = root.tsconfig;
		this.program = ts.createIncrementalProgram<ts.BuilderProgram>({
			rootNames: this.config.fileNames,
			options: this.config.options
		}).getProgram();
		this.modules = this.loadModules();
	}

	private loadModules(): Map<string, Module> {
		const modules = new Map<string, Module>();
		this.config.fileNames.forEach((path) => {
			const source = this.program.getSourceFile(path);

			if (source === undefined) {
				throw new Error(`Could not get source file for ${path}!`);
			}

			modules.set(path, new Module(this, path, source));
		});
		modules.forEach(mod => mod.resolveExportAliases(this, modules));
		return modules;
	}

	public getModule(path: string): Module {
		if (!this.modules.has(path))
			throw new Error(`Could not find module at ${path}!`);
		return this.modules.get(path)!;
	}

	public createManifest() {
		const manifest: ComptimeManifest = {};
		for (const [path, mod] of this.modules) {
			if (mod.hasComptimeExports) {
				const relativePath = this.root.getRealtiveSourcePath(path);
				manifest[relativePath] = {};
				mod.comptimeExports.forEach(e => {
					if (e.type)
						manifest[relativePath]![e.name] = e.type;
				});
			}
		}

		writeFileSync(resolve(this.root.path, "comptime.manifest.json"), JSON.stringify(manifest, null, 2));
	}

	public compile() {
		this.createManifest();
	}
}