import * as ts from "typescript/ast";
import { Ast, EvaluationType } from "./ast.js";
import assert from "node:assert";

export abstract class Expression<T extends ts.Node = ts.Node> extends Ast<T> {

}

export class FunctionCall extends Expression<ts.CallExpression> {
	public override get evaluationType(): EvaluationType {
		if (!!this.arguments.find(arg => arg.evaluationType === "runtime"))
			return "runtime";
		console.log(this.declaration);
		return this.declaration.evaluationType;
	}

	public get arguments() {
		return this.compiler.ast.resolveArray(this.node.arguments).filter(s => s.is(Expression));
	}

	public get declaration() {
		const signature = this.compiler.checker.getResolvedSignature(this.node);
		const declaration = signature.declaration?.resolve();
		assert.ok(declaration);
		return this.compiler.ast.resolve(declaration);
	}
}