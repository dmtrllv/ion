import * as ts from "typescript/ast";
import { Ast } from "./ast.js";
import { Statement } from "./statement.js";
export declare class Function extends Ast<ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction> {
    get parameters(): any[];
    get isAsync(): boolean;
    get isGenerator(): boolean;
    get generics(): any[];
    get returnType(): any[];
    get statments(): Statement[];
}
