import * as ts from "typescript";
import { Compiler } from "../compiler.js";
import { Pass } from "./pass.js";
import { ModuleMap } from "./resolver.js";
import { dirname, relative, resolve, sep, join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { Module } from "../module.js";

export class ModuleTransformer implements Pass<TransformedModule[], [ModuleMap, string]> {
	public async run(compiler: Compiler, modules: ModuleMap, outputPath: string): Promise<TransformedModule[]> {
		const transformedModules: TransformedModule[] = [];
		for (const path in modules) {
			const module = modules[path]!;
			const output = join(outputPath, compiler.relativePath(path).replace(".ts", ".js").replace(".jsx", ".js"));
			this.transformComptimeModule(compiler, module, output)
			transformedModules.push({
				module: module,
				path: output
			});
		}
		return transformedModules;
	}

	private resolveComptimeImport(
		module: Module,
		node: ts.ImportDeclaration,
		outputPath: string,
	): string | undefined {
		if (!ts.isStringLiteral(node.moduleSpecifier)) {
			return undefined;
		}

		const specifier = node.moduleSpecifier.text;

		// Only rewrite bare package imports.
		if (specifier.startsWith(".") || specifier.startsWith("/")) {
			return undefined;
		}

		const imported = module.imports.find(item => item.node === node);

		if (!imported) {
			return undefined;
		}

		// Find the package containing the resolved import.
		let directory = dirname(resolve(imported.absolutePath));
		let packageRoot: string | undefined;
		let packageJson: Record<string, any> | undefined;

		while (true) {
			try {
				const candidate = JSON.parse(
					readFileSync(resolve(directory, "package.json"), "utf8"),
				);

				if (typeof candidate.name === "string") {
					packageRoot = directory;
					packageJson = candidate;
					break;
				}
			} catch {
				// Continue searching parent directories.
			}

			const parent = dirname(directory);

			if (parent === directory) {
				return undefined;
			}

			directory = parent;
		}

		const comptimeOutput = packageJson?.["ion"]?.comptime?.output;

		if (typeof comptimeOutput !== "string") {
			return undefined;
		}

		// Remove the package name, leaving any subpath.
		const packageName = packageJson!["name"] as string;

		if (
			specifier !== packageName &&
			!specifier.startsWith(`${packageName}/`)
		) {
			return undefined;
		}

		const subpath = specifier === packageName
			? "index.js"
			: specifier.slice(packageName.length + 1)
				.replace(/\.(tsx?|mts|cts|mjs|cjs)$/, ".js");

		const target = resolve(packageRoot!, comptimeOutput, subpath);

		let relativePath = relative(
			dirname(resolve(outputPath)),
			target,
		).split(sep).join("/");

		if (!relativePath.startsWith(".")) {
			relativePath = `./${relativePath}`;
		}

		return relativePath;
	}

	private transformComptimeModule(compiler: Compiler, module: Module, outputPath: string): void {
		const toRemove = new Set(module.removeStatements);
		const macroDeclarations = new Set(module.macroDeclarations.map(macro => macro.statement));

		const transformer: ts.TransformerFactory<ts.SourceFile> = context => {
			const visit: ts.Visitor = node => {
				if (ts.isVariableStatement(node)) {
					if (toRemove.has(node)) {
						return undefined;
					}

					const declarations = node.declarationList.declarations.filter(declaration => !toRemove.has(declaration));

					if (declarations.length === 0) {
						return undefined;
					}

					const hasMacroDeclaration = declarations.some(declaration => macroDeclarations.has(declaration));
					const modifiers = node.modifiers ? [...node.modifiers] : [];

					if (hasMacroDeclaration && !modifiers.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
						modifiers.unshift(ts.factory.createModifier(ts.SyntaxKind.ExportKeyword));
					}

					const declarationList = declarations.length === node.declarationList.declarations.length
						? node.declarationList
						: ts.factory.updateVariableDeclarationList(node.declarationList, declarations);

					if (declarationList !== node.declarationList || hasMacroDeclaration) {
						return ts.factory.updateVariableStatement(node, modifiers, declarationList);
					}
				} else if (toRemove.has(node)) {
					return undefined;
				}
				// todo: follow packages exports too
				if (ts.isImportDeclaration(node)) {
					const rewritten = this.resolveComptimeImport(
						module,
						node,
						outputPath,
					);

					if (rewritten) {
						return ts.factory.updateImportDeclaration(
							node,
							node.modifiers,
							node.importClause,
							ts.factory.createStringLiteral(rewritten),
							node.attributes,
						);
					}
				}

				return ts.visitEachChild(node, visit, context);
			};

			return sourceFile => ts.visitNode(sourceFile, visit) as ts.SourceFile;
		};

		const result = ts.transform(module.sourceFile, [transformer]);

		try {
			const transformed = result.transformed[0]!;
			const transformedSource = ts.createPrinter({ removeComments: true }).printFile(transformed);
			const js = ts.transpileModule(transformedSource, {
				compilerOptions: {
					target: ts.ScriptTarget.ESNext,
					module: ts.ModuleKind.ESNext,
					removeComments: true,
					jsxImportSource: compiler.options.jsxImportSource!,
					jsx: ts.JsxEmit.ReactJSX,
					jsxFragmentFactory: compiler.options.jsxFragmentFactory!,
					jsxFactory: compiler.options.jsxFactory!,
				},
				fileName: module.sourceFile.fileName.replace(/\.tsx?$/, ".js"),
			});
			writeFileSync(outputPath, js.outputText, "utf-8");
		} catch (e) {
			console.warn(e);
		} finally {
			result.dispose();
		}
	}
}

export type TransformedModule = {
	module: Module,
	path: string;
};

//export type TransformedModules = Record<string, TransformedModule>;