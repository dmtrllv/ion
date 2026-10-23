import { VariableDeclaration } from "typescript/ast";
import * as ts from "typescript/ast";
import { cached } from "../utils.js";
import { Ast } from "./ast.js";
import assert from "node:assert";
import { Expression } from "./expression.js";
import { Exportable } from "./statement.js";

@Ast.register(ts.isVariableStatement)
export class VariableStatement extends Ast<ts.VariableStatement> implements Exportable {
	@cached
	public get variables() {
		return this.compiler.ast.resolveArray<Variable>(this.node.declarationList.declarations);
	}

	@cached
	public get isExported(): boolean {
		if (this.node.modifiers)
			return this.node.modifiers.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) === true;
		return false;
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
	public get expression() {
		return this.node.initializer && this.compiler.ast.resolve<Expression>(this.node.initializer);
	}
}