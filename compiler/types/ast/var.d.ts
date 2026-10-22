import { VariableDeclaration } from "typescript/ast";
import * as ts from "typescript/ast";
import { Ast } from "./ast.js";
import { Expression } from "./expression.js";
export declare class VariableStatement extends Ast<ts.VariableStatement> {
    get variables(): Variable[];
}
export declare class Variable extends Ast<VariableDeclaration> {
    get name(): string;
    get expression(): Expression | undefined;
}
