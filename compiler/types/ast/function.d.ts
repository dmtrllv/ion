import * as ts from "typescript/ast";
import { Ast } from "./ast.js";
import { Statement } from "./statement.js";
import { EvaluationType } from "./expression.js";
export declare class Function extends Ast<ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction> {
    get isAnonymous(): boolean;
    get name(): string | undefined;
    get parameters(): any[];
    get isAsync(): boolean;
    get isGenerator(): boolean;
    get generics(): any[];
    get returnType(): any[];
    get statments(): Promise<Statement[]>;
    get evaluationType(): EvaluationType;
}
