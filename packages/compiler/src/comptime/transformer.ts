import ts from "typescript";
import { Module } from "../module.js";
import { Compiler } from "../compiler.js";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative } from "node:path";
import assert from "node:assert";
import { isNodeBuiltinModule } from "../utils.js";
import { Package } from "../package.js";

export class ComptimeTransformer {
	public readonly compiler: Compiler;

	public constructor(compiler: Compiler) {
		this.compiler = compiler;
	}

	public readonly transformProgram = async (): Promise<{ diagnostics: readonly ts.Diagnostic[]; modules: Map<string, ComptimeModule> }> => {
		const emitted = new Map<string, string>();

		const result = this.compiler.program.emit(undefined, (path, src) => emitted.set(path, src), undefined, false, {
			before: [this.transformer]
		});

		const modules = new Map<string, ComptimeModule>();

		await Promise.all(emitted.entries().map(async ([path, source]) => {
			const sourcePath = this.compiler.rootPackage.resolveSourcePathFromOutputPath(path);
			const comptimePath = this.compiler.rootPackage.comptimePathFromOutputPath(path);

			const module = this.compiler.modules.get(sourcePath);
			assert.ok(module);

			await mkdir(dirname(comptimePath), { recursive: true });
			await writeFile(comptimePath, source, "utf-8");

			modules.set(comptimePath, {
				sourcePath,
				comptimePath,
				module,
				source
			});
		}));

		return {
			diagnostics: result.diagnostics,
			modules
		};
	}

	private readonly transformer: ts.TransformerFactory<ts.SourceFile> = (_) => (sourceFile) => {
		const statements: ts.Statement[] = [];
		//const addedExports: Set<string> = new Set();
		for (const stmt of sourceFile.statements) {
			if (ts.isImportDeclaration(stmt)) {
				const importStmt = this.transformImport(sourceFile, stmt);
				if (importStmt)
					statements.push(importStmt);
			} else if (ts.isVariableStatement(stmt)) {
				//const isExport = ts.canHaveModifiers(stmt) && stmt.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
				const declList: ts.VariableDeclaration[] = [];
				for (const decl of stmt.declarationList.declarations) {
					const type = this.compiler.comptimeResolver.resolveVarDeclaration(decl);
					if (type) {
						//if (!isExport) {
						//	addedExports.add(decl.name.getText())
						//}
						declList.push(decl);
					}
				}
				if (declList.length > 0) {
					const modifiers = ts.factory.createModifier(ts.SyntaxKind.ExportKeyword);
					const newDeclList = ts.factory.updateVariableDeclarationList(stmt.declarationList, declList);
					statements.push(ts.factory.updateVariableStatement(stmt, [modifiers], newDeclList));
				}
			} else {
				statements.push(stmt);
			}
		}
		return ts.factory.updateSourceFile(sourceFile, statements);
	};

	private transformImport(sourceFile: ts.SourceFile, stmt: ts.ImportDeclaration): ts.ImportDeclaration | undefined {
		if (!ts.isStringLiteral(stmt.moduleSpecifier))
			return undefined;

		const importPath = stmt.moduleSpecifier.text;

		if (isNodeBuiltinModule(importPath) || importPath === "@ion/comptime") {
			return stmt;
		}

		const resolved = ts.resolveModuleName(importPath, sourceFile.fileName, this.compiler.config.options, ts.sys).resolvedModule;
		assert.ok(resolved);
		const pkg = Package.fromModulePath(resolved.resolvedFileName);
		assert.ok(pkg);
		if (pkg.isComptime) {
			const resolvedPath = resolved.resolvedFileName.replace(pkg.sourcePath, pkg.comptimePath);
			const relativePath = relative(dirname(sourceFile.fileName), resolvedPath).replace(/\.tsx?$/, ".js");
			return ts.factory.updateImportDeclaration(stmt, stmt.modifiers, stmt.importClause, ts.factory.createStringLiteral(relativePath), stmt.attributes);
		}

		return stmt;
	}
}

export type ComptimeModule = {
	module: Module;
	sourcePath: string;
	comptimePath: string;
	source: string;
};