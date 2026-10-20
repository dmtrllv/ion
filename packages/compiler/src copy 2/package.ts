import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve, parse, join } from "node:path";
import { cached, mapObj } from "./utils.js";
import { node_modules } from "./env.js";
import ts from "typescript";
import { ComptimeType } from "./module.js";

export class Package {
	static fromModulePath(modulePath: string): Package {
		let directory = dirname(modulePath);
		const { root } = parse(directory);

		while (directory !== root) {
			const packageJson = join(directory, "package.json");

			if (existsSync(packageJson)) {
				return Package.get(directory);
			}

			directory = dirname(directory);
		}

		throw new Error(`Could not find package from module path ${modulePath}!`);
	}

	static readonly #cache = new Map<string, Package>();

	public static get(root: string): Package {
		if (!this.#cache.has(root)) {
			this.#cache.set(root, new Package(root));
		}
		return this.#cache.get(root)!;
	}

	public readonly path: string;
	public readonly json: PackageJson;

	public constructor(root: string) {
		this.path = root;
		this.json = JSON.parse(readFileSync(resolve(root, "package.json"), "utf-8"));
	}

	@cached
	public get sourceDir() {
		if(this.tsconfig.options.rootDir)
			return resolve(this.path, this.tsconfig.options.rootDir);
		return this.path;
	}

	@cached
	public get declDir() {
		if(this.tsconfig.options.declarationDir)
			return this.tsconfig.options.declarationDir;
		if(this.tsconfig.options.outDir)
			return this.tsconfig.options.outDir;
		return this.path;
	}

	public getRealtiveSourcePath(path: string) {
		return path.replace(this.sourceDir, ".");
	}

	public getRealtiveSourcePathFromTyping(path: string) {
		return path.replace(this.declDir, ".").replace(".d.ts", ".ts");
	}

	public getComptimePath(path: string) {
		return resolve(this.comptimeOutput, path.replace(this.sourceDir, ".").replace(/\.tsx?$/, ".js"));
	}
	
	@cached
	public get relativeComptimeOutput() {
		const comptime = this.json.ion?.comptime;
		let path = "comptime-build";
		if (comptime && typeof comptime !== "boolean" && comptime.output) {
			path = comptime.output;
		}
		return path
	}

	@cached
	public get comptimeOutput() {
		return resolve(this.path, this.relativeComptimeOutput);
	}

	@cached
	public get tsconfig(): ts.ParsedCommandLine {
		const configPath = resolve(this.path, "tsconfig.json");
		const configFile = ts.readConfigFile(configPath, ts.sys.readFile);

		if (configFile.error) {
			throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
		}

		const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, this.path, undefined, configPath);

		if (config.errors.length > 0) {
			throw new Error(config.errors.map(error => ts.flattenDiagnosticMessageText(error.messageText, "\n")).join("\n"));
		}

		return config;
	}

	@cached
	public get comptimeManifest(): ComptimeManifest | null {
		const path = resolve(this.path, "comptime.manifest.json");
		if (existsSync(path))
			return JSON.parse(readFileSync(path, "utf-8")) as ComptimeManifest;
		return null;
	}

	@cached
	public get dependencies() {
		return mapObj(this.json.dependencies, (_version, name) => Package.get(resolve(node_modules, name)));
	}

	@cached
	public get devDependencies() {
		return mapObj(this.json.devDependencies, (_version, name) => Package.get(resolve(node_modules, name)));
	}
}

export type PackageJson = {
	name?: string;
	version?: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	exports?: Record<string, Record<string, string>>;
	ion?: IonConfig;
};

export type IonConfig = {
	comptime?: boolean | {
		output?: string;
	};
};

export type ComptimeManifest = {
	[path: string]: {
		[name: string]: ComptimeType;
	}
};