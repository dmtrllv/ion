import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cached, mapObj } from "./utils.js";
import { node_modules } from "./env.js";
import ts from "typescript";

export class Package {
	static readonly #cache = new Map<string, Package>();

	public static get(root: string): Package {
		if (!this.#cache.has(root)) {
			this.#cache.set(root, new Package(root));
		}
		return this.#cache.get(root)!;
	}

	public readonly root: string;
	public readonly json: PackageJson;

	public constructor(root: string) {
		this.root = root;
		this.json = JSON.parse(readFileSync(resolve(root, "package.json"), "utf-8"));
	}

	@cached
	public get tsconfig(): ts.ParsedCommandLine {
		const configPath = resolve(this.root, "tsconfig.json");
		const configFile = ts.readConfigFile(configPath, ts.sys.readFile);

		if (configFile.error) {
			throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
		}

		const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, this.root, undefined, configPath);

		if (config.errors.length > 0) {
			throw new Error(config.errors.map(error => ts.flattenDiagnosticMessageText(error.messageText, "\n")).join("\n"));
		}

		return config;
	}

	@cached
	public get comptimeManifest(): ComptimeManifest | null {
		const path = resolve(this.root, "comptime.manifest.json");
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

	@cached
	public get isComptimeLibrary() {
		return this.comptimeManifest !== null
	}
}

export type PackageJson = {
	name?: string;
	version?: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	ion?: IonConfig;
};

export type IonConfig = {
	comptime?: boolean | {
		output?: string;
	};
};

export type ComptimeManifest = {
	exports: Record<string, string>;
};