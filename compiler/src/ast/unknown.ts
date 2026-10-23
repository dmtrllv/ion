import { Node } from "typescript/ast";
import { Ast, EvaluationType } from "./ast.js";

export class Unknown extends Ast<Node> {
	public override get evaluationType(): EvaluationType {
		return "runtime";
	}
	
}