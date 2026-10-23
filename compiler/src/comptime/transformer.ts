import { Module } from "../ast/module.js";
import * as ts from "typescript/ast";
import { factory } from "typescript/ast";
import { Compiler } from "../compiler.js";
import { Import } from "../ast/import.js";
import { dirname, relative } from "node:path";
import { Ast } from "../ast/ast.js";
import { VariableStatement } from "../ast/var.js";

export class ComptimeModuleTransformer {
	public constructor() {

	}

	public transform(compiler: Compiler, module: Module): Module {
		const moduleDir = dirname(module.path);

		//const ctx = new AstTransformContext();

		//const transformer = createTransformFunction(ctx);

		const macros = module.getMacroDeclarations();

		const missingMacroExports: ts.ExportSpecifier[] = [];

		macros.forEach(m => {
			if (!m.isExported)
				missingMacroExports.push(factory.createExportSpecifier(false, undefined, factory.createIdentifier(m.name)));
		});

		const statements = module.node.statements.map(stmt => {
			const ast = compiler.ast.resolve(stmt);
			
			if (ast.is(Import)) {
				const importedMod = ast.getModule();
				//if(importedMod.package.isComptime)

				const copmtimePath = importedMod.resolveComptimePath();
				const relativePath = relative(moduleDir, copmtimePath);
				console.log(relativePath);
			} else if(ast.is(VariableStatement)) {
				const keep: any = [];
				for(const v of ast.variables) {
					if((v.expression)?.evaluationType !== "runtime") {
						keep.push()
					}
				}
			}

			return stmt;
		});

		statements.push(factory.createExportDeclaration(undefined, false, factory.createNamedExports(missingMacroExports), undefined));

		const updated = factory.updateSourceFile(module.node, statements, module.node.endOfFileToken);

		const printed = compiler.api.printer.printFile(updated);
		const result = compiler.api.transpileModule(printed, {
			compilerOptions: { target: ts.ScriptTarget.ES2022, removeComments: true },
		});
		console.log(result);
		return new Module(compiler, updated);
	}
}

export class AstTransformContext {
	public createClass(_name: string) {

	}
}

export const createTransformFunction = (ctx: AstTransformContext) => {
	return <T extends Ast>(ast: T, transformer: (ast: Ast, ctx: AstTransformContext) => Ast): T => {
		const transform = (ast: Ast): Ast => {
			const transformed = transformer(ast, ctx);

			for (const child of transformed.getChildren()) {
				transform(child);
			}

			return transformed;
		};

		return transform(ast) as T;
	};
}