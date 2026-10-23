import * as ts from "typescript/ast";
import { Ast, EvaluationType } from "./ast.js";
import { Statement } from "./statement.js";
export declare class Function extends Ast<ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction> {
    get isAnonymous(): boolean;
    get name(): string | undefined;
    get parameters(): any[];
    get isAsync(): boolean;
    get isGenerator(): boolean;
    get generics(): any[];
    get returnType(): any[];
    get statments(): Statement[];
    get evaluationType(): EvaluationType;
}
