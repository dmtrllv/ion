import { ClassDeclaration, ClassExpression } from "typescript/ast";
import { EvaluationType } from "./ast.js";
import { Expression } from "./expression.js";
export declare class Class extends Expression<ClassDeclaration | ClassExpression> {
    get evaluationType(): EvaluationType;
    get name(): string | undefined;
}
