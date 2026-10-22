import { ClassDeclaration, ClassExpression } from "typescript/ast";
import { Ast } from "./ast.js";

export class Class extends Ast<ClassDeclaration | ClassExpression> {
	
}