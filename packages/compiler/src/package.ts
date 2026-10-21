import assert from "node:assert";
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

	public static readonly fromModulePath = (path: string): Package | undefined => {
		let current = dirname(realpathSync(path));
		while (!existsSync(join(current, "package.json"))) {
			const parent = dirname(current);
			if (parent === current) {
				return undefined;
			}
			current = parent;
		}
		return this.get(current);
	}

	public readonly path: string;
	public readonly tsConfig: ts.ParsedCommandLine | null;
	public readonly json: PackageJson;
	public readonly comptimeManifest: ComptimeManifest | null;

	public get name() { return this.json.name; }
	public get version() { return this.json.version; }
	public get isComptime() { return this.comptimeManifest !== null; }
	public get sourcePath() { return this.tsConfig?.options.rootDir || this.path; }
	public get outputPath() { return this.tsConfig?.options.outDir || this.path; }
	
	public get comptimePath() {
		return resolve(this.path, this.json.ion?.comptime?.output ?? "comptime-output");
	}

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

	public comptimePathFromOutputPath(path: string) {
		return path.replace(this.outputPath, this.comptimePath);
	}

	public resolveSourcePathFromOutputPath(path: string): string {
		path = path.replace(this.outputPath, this.sourcePath);
		if(!existsSync(path))
			path = path.replace(/\.js$/, ".ts");
		if(!existsSync(path))
			path = path.replace(/\.ts$/, ".tsx");
		if(!existsSync(path))
			throw new Error(`Could not resolve source path from output path ${path}!`);
		return path;
	}
}