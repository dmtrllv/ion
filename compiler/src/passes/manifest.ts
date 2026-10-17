
import * as ts from "typescript";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { writeFileSync } from "node:fs";

import { Compiler } from "../compiler.js";
import { MacroType } from "../module.js";
import { Pass } from "./pass.js";
import { ModuleMap } from "./resolver.js";
import { TransformedModule } from "./transformer.js";

export type ComptimeManifest = {
	readonly version: 1;
	readonly exports: Record<string, ComptimeManifestExport>;
};

export type ComptimeManifestExport = {
	readonly kind: MacroType;
	readonly module: string;
	readonly name: string;
	readonly source: string;
};

type PackageJson = {
	exports?: Record<string, unknown> | string;
	main?: string;
};

export class ComptimeManifestWriter
	implements Pass<void, [ModuleMap, TransformedModule[], PackageJson]> {
	public async run(
		compiler: Compiler,
		modules: ModuleMap,
		transformedModules: TransformedModule[],
		pkg: PackageJson,
	): Promise<void> {
		const entryPath = this.resolvePackageEntry(compiler.root, pkg);
		const entryModule = Object.values(modules).find(
			module => resolve(module.fullPath) === entryPath,
		);

		if (!entryModule) {
			throw new Error(
				`Could not find the package entry module "${entryPath}" in the TypeScript program.`,
			);
		}

		const transformedByModule = new Map(
			transformedModules.map(item => [item.module, item]),
		);

		const exports: Record<string, ComptimeManifestExport> = {};

		for (const exported of entryModule.exports) {
			const declarationModule = exported.targetModule;

			if (!declarationModule) {
				continue;
			}

			const declaration =
				declarationModule.getComptimeDeclaration(exported.target);

			if (!declaration) {
				continue;
			}

			const transformed = transformedByModule.get(declarationModule);

			if (!transformed) {
				throw new Error(
					`No transformed module for comptime export "${exported.name}".`,
				);
			}

			exports[exported.name] = {
				kind: this.getEffectiveKind(
					declaration.type,
					declaration.statement.initializer,
				),
				module: relative(compiler.root, transformed.path)
					.split(sep)
					.join("/"),
				name: declaration.statement.name.getText(
					declarationModule.sourceFile,
				),
				source: relative(compiler.root, declarationModule.fullPath)
					.split(sep)
					.join("/"),
			};
		}

		const manifest: ComptimeManifest = {
			version: 1,
			exports,
		};

		writeFileSync(
			resolve(compiler.root, "comptime.manifest.json"),
			JSON.stringify(manifest, null, 2) + "\n",
			"utf-8",
		);
	}



	private resolvePackageEntry(root: string, pkg: PackageJson): string {
		const configPath = ts.findConfigFile(
			root,
			ts.sys.fileExists,
			"tsconfig.json",
		);

		if (!configPath) {
			throw new Error(
				`Could not find tsconfig.json for package "${root}".`,
			);
		}

		const config = ts.getParsedCommandLineOfConfigFile(
			configPath,
			{},
			{
				...ts.sys,
				onUnRecoverableConfigFileDiagnostic(diagnostic) {
					throw new Error(
						ts.flattenDiagnosticMessageText(
							diagnostic.messageText,
							"\n",
						),
					);
				},
			},
		);

		if (!config) {
			throw new Error(`Could not parse TypeScript config "${configPath}".`);
		}

		const entry = this.resolvePackageEntrySpecifier(pkg);

		if (!entry) {
			throw new Error(
				'Could not determine the package entry point from package.json ("exports"."." or "main").',
			);
		}

		const entryPath = resolve(root, entry);
		const options = config.options;

		const outputRoots = [
			options.outDir,
			options.declarationDir,
		].filter((path): path is string => path !== undefined);

		for (const outputRoot of outputRoots) {
			const absoluteOutputRoot = resolve(root, outputRoot);
			const relativeEntry = relative(absoluteOutputRoot, entryPath);

			// Only map entries that are actually inside this output directory.
			if (
				relativeEntry === ".." ||
				relativeEntry.startsWith(`..${sep}`) ||
				isAbsolute(relativeEntry)
			) {
				continue;
			}

			const sourceRoot = options.rootDir
				? resolve(root, options.rootDir)
				: this.getCommonSourceDirectory(config.fileNames, root);

			const sourcePath = resolve(
				sourceRoot,
				relativeEntry.replace(
					/\.(?:d\.)?(?:m|c)?js$/,
					".ts",
				),
			);

			return sourcePath;
		}

		// If the entry is already source-oriented, resolve it directly.
		const sourcePath = entryPath.replace(/\.js$/, ".ts");
		return resolve(root, sourcePath);
	}

	private resolvePackageEntrySpecifier(
		pkg: PackageJson,
	): string | undefined {
		const exports = pkg.exports;

		let entry: string | undefined;

		if (typeof exports === "string") {
			entry = exports;
		} else if (exports) {
			entry = this.findImportEntry(exports["."]);
		}

		return entry ?? pkg.main;
	}

	private findImportEntry(value: unknown): string | undefined {
		if (typeof value === "string") {
			return value;
		}

		if (!value || typeof value !== "object") {
			return undefined;
		}

		const conditions = value as Record<string, unknown>;

		for (const key of ["import", "default", "node", "types"]) {
			const result = this.findImportEntry(conditions[key]);

			if (result) {
				return result;
			}
		}

		return undefined;
	}

	private getCommonSourceDirectory(
		files: readonly string[],
		root: string,
	): string {
		const paths = files.map(file => resolve(file));
		if (paths.length === 0) {
			return root;
		}

		const first = paths[0]!.split(sep);
		let common = first.slice(0, -1);

		for (const path of paths.slice(1)) {
			const parts = path.split(sep);
			let index = 0;

			while (
				index < common.length &&
				index < parts.length &&
				common[index] === parts[index]
			) {
				index++;
			}

			common = common.slice(0, index);
		}

		return common.join(sep) || root;
	}



	private getEffectiveKind(
		kind: MacroType,
		initializer: ts.Expression | undefined,
	): MacroType {
		if (
			kind !== "comptime" ||
			!initializer ||
			!ts.isCallExpression(initializer)
		) {
			return kind;
		}

		// A comptime declaration can return a comptime.fn value.
		// Detect the common expression-bodied and return-bodied forms.
		const callback = initializer.arguments[0];

		if (
			!callback ||
			(!ts.isArrowFunction(callback) &&
				!ts.isFunctionExpression(callback))
		) {
			return kind;
		}

		const body = callback.body;
		const returnedExpression = ts.isBlock(body)
			? body.statements.find(ts.isReturnStatement)?.expression
			: body;

		if (
			returnedExpression &&
			ts.isCallExpression(returnedExpression) &&
			ts.isPropertyAccessExpression(returnedExpression.expression) &&
			returnedExpression.expression.name.text === "fn"
		) {
			return "comptime.fn";
		}

		return kind;
	}
}
