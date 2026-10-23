import assert from "node:assert";
import { isAbsolute, resolve } from "node:path";
import { existsSync } from "node:fs";
import { loadPackageJson, PackageJson } from "./package-json.js";
import { ComptimeManifest } from "./comptime/manifest.js";
import { API, formatDiagnosticsWithColorAndContext, ParsedCommandLine } from "typescript/sync";

export class Package {
	public static load(api: API<false>, path: string) {
		assert.ok(isAbsolute(path), `Path ${path} provided to Package constructor must be an absolute path`);
		const config = Package.#loadTsConfig(api, path);
		return new Package(path, config);
	}

	static #loadTsConfig(api: API, root: string) {
		const configPath = resolve(root, "tsconfig.json");
		if (!existsSync(configPath))
			return undefined;

		const configFile = api.readConfigFile(configPath);
		if (configFile.error) {
			console.log(formatDiagnosticsWithColorAndContext([configFile.error], api));
			return undefined;
		}

		const config = api.parseJsonConfigFileContent(configFile.config, { configDirectory: root });
		if (config.errors.length > 0) {
			console.log(formatDiagnosticsWithColorAndContext(config.errors, api));
			return undefined;
		}

		return config;
	}

	public readonly tsConfig: ParsedCommandLine | undefined;
	public readonly path: string;
	public readonly json: PackageJson;
	public readonly comptimeManifest: ComptimeManifest | undefined;

	public get name() { return this.json.name; }
	public get version() { return this.json.version; }
	public get isComptime() { return this.comptimeManifest !== undefined; }
	public get sourcePath() { return this.tsConfig?.options.rootDir || this.path; }
	public get outputPath() { return this.tsConfig?.options.outDir || this.path; }
	public get typeDeclarationPath() { return this.tsConfig?.options.declarationDir || this.outputPath; }

	public get comptimePath() {
		return resolve(this.path, this.json.ion?.comptime?.output ?? "comptime-output");
	}

	public get sourceFilePaths() { return this.tsConfig?.fileNames || []; }

	private constructor(path: string, tsConfig: ParsedCommandLine | undefined) {
		assert.ok(isAbsolute(path), "provided package path must be absolute");
		this.path = path;
		this.json = loadPackageJson(path);
		this.tsConfig = tsConfig;
		const manifestPath = resolve(path, "comptime.manifest.json");
		if (!existsSync(manifestPath))
			this.comptimeManifest = undefined;
		else
			this.comptimeManifest = ComptimeManifest.load(manifestPath);
	}

	public comptimePathFromOutputPath(path: string) {
		return path.replace(this.outputPath, this.comptimePath);
	}

	public resolveSourcePathFromOutputPath(path: string): string {
		path = path.replace(this.outputPath, this.sourcePath);
		if (!existsSync(path))
			path = path.replace(/\.js$/, ".ts");
		if (!existsSync(path))
			path = path.replace(/\.ts$/, ".tsx");
		if (!existsSync(path))
			throw new Error(`Could not resolve source path from output path ${path}!`);
		return path;
	}
}