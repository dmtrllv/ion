import ts from "typescript";
import assert from "node:assert";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { node_modules } from "./env.js";
import { cached } from "./utils.js";
import { ComptimeManifest } from "./comptime.js";

export class Package {
	static readonly #cache = new Map<string, Package>();

	public static readonly get = (path: string) => {
		assert.ok(isAbsolute(path), `Path ${path} provided to Package constructor must be an absolute path`);
		if (!this.#cache.has(path))
			this.#cache.set(path, new Package(path));
		return this.#cache.get(path)!;
	}

	public static readonly getFromName = (name: string) => this.get(resolve(node_modules, name));

	public static readonly findFromSource = (path: string) => {
		const isPackageRoot = (path: string) => {
			const pkgPath = join(path, "package.json");
			if (!existsSync(pkgPath))
				return false;
			const json = JSON.parse(readFileSync(pkgPath, "utf-8"));
			return "name" in json;
		};

		let current = dirname(realpathSync(path));
		while (!isPackageRoot(current)) {
			const parent = dirname(current);

			if (parent === current) {
				throw new Error("Could not find package!");
			}

			current = parent;
		}

		return this.get(current);
	}

	public readonly path: string;

	public readonly json: PackageJson;

	public readonly comptimeManifest?: ComptimeManifest;

	@cached
	public get name(): string {
		return this.json.name;
	}

	@cached
	public get dependencies(): Record<string, string> {
		return this.json.dependencies || {};
	}

	@cached
	public get isComptime() {
		return this.comptimeManifest !== undefined;
	}

	@cached
	public get comptimeOutput() {
		return resolve(this.path, this.json?.ion?.comptime?.output || "comptime-build");
	}

	@cached
	public get sourceDir(): string {
		return resolve(this.path, this.tsconfig.options.rootDir || ".");
	}

	@cached
	public get buildDir() {
		return resolve(this.path, this.tsconfig.options.outDir || ".");
	}

	private constructor(path: string) {
		this.path = realpathSync(path);
		const jsonPath = join(path, "package.json");
		const json = JSON.parse(readFileSync(jsonPath, "utf-8"));
		assert.ok(json.name, `Missing name in ${jsonPath}`);
		this.json = json;

		const manifestPath = join(this.path, "comptime.manifest.json");
		if (existsSync(manifestPath))
			this.comptimeManifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
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

	public getRelativeSourcePath(path: string) {
		path = realpathSync(path);
		return relative(this.sourceDir, path);
	}

}

export type PackageJson = {
	name: string;
	version?: string;
	dependencies?: Record<string, string>;
	ion?: {
		comptime?: {
			output?: string;
		}
	}
}