import * as ts from "typescript/ast";
import { Ast } from "./ast.js";
import { Statement } from "./statement.js";
import { cached } from "../utils.js";

@Ast.register(ts.isFunctionDeclaration)
export class Function extends Ast<ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction> {
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
		throw new Error("TODO");
	}

}