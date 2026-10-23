import { Ast, EvaluationType } from "./ast.js";
import * as ts from "typescript/ast";

@Ast.register(ts.isStringLiteral)
export class StringLiteral extends Ast<ts.StringLiteral> {
	public override get evaluationType(): EvaluationType {
		return "constant";
	}
	
	public get text() { return this.node.text; }
}