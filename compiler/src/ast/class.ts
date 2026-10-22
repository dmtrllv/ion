import { ClassDeclaration, ClassExpression, isClassDeclaration, isClassExpression } from "typescript/ast";
import { Ast } from "./ast.js";
import { cached } from "../utils.js";
import { EvaluationType, Expression } from "./expression.js";

@Ast.register(node => isClassDeclaration(node) || isClassExpression(node))
export class Class extends Expression<ClassDeclaration | ClassExpression> {
	@cached
	public override get evaluationType(): EvaluationType {
		return "runtime";
	}

	@cached
	public get name() {
		return this.node.name?.text;
	}
}