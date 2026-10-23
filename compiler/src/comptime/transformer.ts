import { Module } from "../ast/module.js";
import * as ts from "typescript/ast";
import { factory } from "typescript/ast";
import { Compiler } from "../compiler.js";
import { Import } from "../ast/import.js";
import { dirname, relative } from "node:path";
import { Macro } from "../ast/macro.js";
import assert from "node:assert";

export class ComptimeModuleTransformer {
	public constructor() {

	}

	public transform(compiler: Compiler, module: Module): string {
		const moduleDir = dirname(module.path);
		const macros = module.statements.filter(s => s.is(Macro));
		const missingMacroExports: ts.ExportSpecifier[] = [];

		macros.forEach(m => {
			if (!m.isExported)
				missingMacroExports.push(factory.createExportSpecifier(false, undefined, factory.createIdentifier(m.name)));
		});

		const statements = module.node.statements.map(stmt => {
			const ast = compiler.ast.resolve(stmt);

			if (ast.is(Import)) {
				const importedMod = ast.getModule();

				const pkg = importedMod.package;

				if (!pkg.isComptime || pkg === compiler.root)
					return stmt;

				let path: string | undefined;
				if (importedMod.path.startsWith(pkg.typeDeclarationPath)) {
					path = importedMod.path.replace(pkg.typeDeclarationPath, pkg.comptimePath).replace(/\.d\.tsx?$/i, ".js");
				} else if (importedMod.path.startsWith(pkg.sourcePath)) {
					path = importedMod.path.replace(pkg.sourcePath, pkg.comptimePath).replace(/\.tsx?$/i, ".js");
				}

				assert.ok(path);

				const relativePath = relative(moduleDir, path);
				console.log("TODO: rewrite to relative import: ", relativePath);
				const importPath = factory.createStringLiteral(relativePath, ts.TokenFlags.StringLiteralFlags);
				return factory.updateImportDeclaration(ast.node, ast.node.modifiers, ast.node.importClause, importPath);
			} else if (ast.evaluationType !== "runtime") {
				return stmt;
			} else {
				console.log("skip runtime ast", ast.constructor.name, ast.evaluationType);
			}

			return null;
		}).filter(s => !!s);

		statements.push(factory.createExportDeclaration(undefined, false, factory.createNamedExports(missingMacroExports), undefined));

		const updated = factory.updateSourceFile(module.node, statements, module.node.endOfFileToken);

		const printed = compiler.api.printer.printFile(updated);
		const result = compiler.api.transpileModule(printed, {
			compilerOptions: { target: ts.ScriptTarget.ES2022, removeComments: true },
		});

		return result.outputText;
	}
}

//export class AstTransformContext {
//	public createClass(_name: string) {

//	}
//}

//export const createTransformFunction = (ctx: AstTransformContext) => {
//	return <T extends Ast>(ast: T, transformer: (ast: Ast, ctx: AstTransformContext) => Ast): T => {
//		const transform = (ast: Ast): Ast => {
//			const transformed = transformer(ast, ctx);

//			for (const child of transformed.getChildren()) {
//				transform(child);
//			}

//			return transformed;
//		};

//		return transform(ast) as T;
//	};
//}