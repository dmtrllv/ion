import assert from "node:assert"
import { dirname, isAbsolute, join, resolve } from "node:path";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import ts from "typescript";
import { loadPackageJson, PackageJson } from "./package-json.js";
import { ComptimeManifest } from "./comptime/manifest.js";

export class Package {
	static readonly #cache = new Map<string, Package>();

	public static readonly get = (path: string) => {
		assert.ok(isAbsolute(path), `Path ${path} provided to Package constructor must be an absolute path`);
		path = realpathSync(path);
		if (!this.#cache.has(path))
			this.#cache.set(path, new Package(path));
		return this.#cache.get(path)!;
	}

	public static readonly fromModulePath = (path: string): Package => {
		let current = dirname(realpathSync(path));
		while (!existsSync(join(current, "package.json"))) {
			const parent = dirname(current);
			if (parent === current) {
				throw new Error("Could not find package!");
			}
			current = parent;
		}
		return this.get(current);
	}

	public get name() { return this.json.name; }
	public get version() { return this.json.version; }
	public get isComptime() { return this.comptimeManifest !== null; }

	public readonly path: string;
	public readonly tsConfig: ts.ParsedCommandLine | null;
	public readonly json: PackageJson;
	public readonly comptimeManifest: ComptimeManifest | null;

	private constructor(path: string) {
		assert.ok(isAbsolute(path), "provided package path must be absolute");
		this.path = path;
		this.json = loadPackageJson(path);
		this.tsConfig = this.loadTsConfig();
		this.comptimeManifest = this.loadComptimeManifest();
	}

	private loadTsConfig(): ts.ParsedCommandLine | null {
		const configPath = resolve(this.path, "tsconfig.json");
		if (!existsSync(configPath))
			return null;

		const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
		if (configFile.error)
			throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));

		const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, this.path, undefined, configPath);
		if (config.errors.length > 0)
			throw new Error(config.errors.map(error => ts.flattenDiagnosticMessageText(error.messageText, "\n")).join("\n"));

		return config;
	}

	private loadComptimeManifest(): ComptimeManifest | null {
		const manifestPath = resolve(this.path, "comptime.manifest.json");
		if (!existsSync(manifestPath))
			return null;
		return JSON.parse(readFileSync(manifestPath, "utf-8"));
	}
}