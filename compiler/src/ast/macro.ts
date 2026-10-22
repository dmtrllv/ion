import * as ts from "typescript/ast";
import { Ast } from "./ast.js";
import { EvaluationType, Expression } from "./expression.js";
import { Compiler } from "../compiler.js";

const isMacro = (node: ts.Node, compiler: Compiler): boolean => {
	if(ts.isCallExpression(node) && ts.isAccessExpression(node.expression)) {
		
	}
	return false;
}

// @internal
@Ast.register(isMacro)
export class MacroDeclaration extends Expression<ts.CallExpression> {
	public override get evaluationType(): EvaluationType {
		return "comptime";
	}
}