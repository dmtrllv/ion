import * as ts from "typescript/ast";
import { Ast } from "./ast.js";
import { Statement } from "./statement.js";
import { cached } from "../utils.js";
import { EvaluationType } from "./expression.js";

@Ast.register(node => ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node))
export class Function extends Ast<ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction> {
	@cached
	public get isAnonymous() {
		return this.name === undefined;
	}

	@cached
	public get name(): string | undefined {
		if (ts.isFunctionDeclaration(this.node) || ts.isFunctionExpression(this.node))
			return this.node.name?.text;
		return undefined;
	}

	@cached
	public get parameters(): any[] {
		throw new Error("TODO");
	}

	@cached
	public get isAsync(): boolean {
		throw new Error("TODO");
	}

	@cached
	public get isGenerator(): boolean {
		throw new Error("TODO");
	}

	@cached
	public get generics(): any[] {
		throw new Error("TODO");
	}

	@cached
	public get returnType(): any[] {
		throw new Error("TODO");
	}

	@cached
	public get statments(): Statement[] {
		if (ts.isFunctionDeclaration(this.node) || ts.isFunctionExpression(this.node))
			return this.compiler.ast.resolveArray(this.node.body?.statements || []);
		else if (ts.isBlock(this.node.body))
			return this.compiler.ast.resolveArray(this.node.body.statements)
		return [this.compiler.ast.resolve<Statement>(this.node.body)];
	}

	@cached
	public get evaluationType(): EvaluationType {
		return "runtime";
	}
}