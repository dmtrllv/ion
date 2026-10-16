import * as ts from "typescript";
import { Compiler } from "../compiler.js";
import { Pass } from "./pass.js";
import { ModuleMap } from "./resolver.js";
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { Module } from "../module.js";

export class ModuleTransformer implements Pass<TransformedModule[], [ModuleMap, string]> {
	public async run(_compiler: Compiler, modules: ModuleMap, outputPath: string): Promise<TransformedModule[]> {
		const transformedModules: TransformedModule[] = [];
		for (const path in modules) {
			const module = modules[path]!;
			const output = join(outputPath, _compiler.relativePath(path).replace(".ts", ".js"));
			this.transformComptimeModule(module, output)
			transformedModules.push({
				module: module,
				path: output
			});
		}
		return transformedModules;
	}

	private transformComptimeModule(module: Module, outputPath: string): void {
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
				},
				fileName: module.sourceFile.fileName,
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