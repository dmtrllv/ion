import { VariableDeclaration } from "typescript/ast";
import * as ts from "typescript/ast";
import { cached } from "../utils.js";
import { Ast } from "./ast.js";
import assert from "node:assert";
import { Expression } from "./expression.js";

@Ast.register(ts.isVariableStatement)
export class VariableStatement extends Ast<ts.VariableStatement> {
	@cached
	public get variables(): Variable[] {
		return this.compiler.ast.resolveArray(this.node.declarationList.declarations);
	}
}

@Ast.register(ts.isVariableDeclaration)
export class Variable extends Ast<VariableDeclaration> {
	@cached
	public get name(): string {
		assert.ok(ts.isIdentifier(this.node.name));
		return this.node.name.text;
	}

	@cached
	public get expression(): Expression | undefined {
		return this.node.initializer && this.compiler.ast.resolve(this.node.initializer);
	}
}