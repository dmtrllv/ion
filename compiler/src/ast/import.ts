import * as ts from "typescript/ast";
import { Ast, EvaluationType } from "./ast.js";
import { cached } from "../utils.js";
import assert from "node:assert";
import { Module } from "./module.js";
import { dirname } from "node:path";

@Ast.register(ts.isImportDeclaration)
export class Import extends Ast<ts.ImportDeclaration> {
	public override get evaluationType(): EvaluationType {
		return "constant";
	}

	@cached
	public get path(): string {
		const path = this.node.moduleSpecifier;
		assert.ok(ts.isStringLiteral(path));
		return path.text;
	}

	@cached
	public getModule(): Module {
		const sourceFile = this.node.getSourceFile();
		using resolver = this.compiler.createResolver();
		const resolved = resolver.resolveModuleName(this.path, dirname(sourceFile.fileName));
		const path = resolved.resolvedModule?.resolvedFileName;
		assert.ok(path, `Cannot resolve module "${this.path}" from "${sourceFile.fileName}"`);
		const source = this.compiler.program.getSourceFile(path);
		assert.ok(source, `Cannot resolve the modules sourfile at "${sourceFile.fileName}"`);
		return this.compiler.ast.resolve(source);
	}
}