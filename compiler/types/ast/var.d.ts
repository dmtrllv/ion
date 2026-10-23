import { VariableDeclaration } from "typescript/ast";
import * as ts from "typescript/ast";
import { Ast } from "./ast.js";
import { Expression } from "./expression.js";
import { Exportable } from "./statement.js";
export declare class VariableStatement extends Ast<ts.VariableStatement> implements Exportable {
    get variables(): Promise<Variable[]>;
    get isExported(): boolean;
}
export declare class Variable extends Ast<VariableDeclaration> {
    get name(): string;
    get expression(): Promise<Expression<ts.Node>> | undefined;
}
