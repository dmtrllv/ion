import { VariableDeclaration } from "typescript/ast";
import * as ts from "typescript/ast";
import { Ast, EvaluationType } from "./ast.js";
import { Expression } from "./expression.js";
import { Exportable } from "./statement.js";
export declare class VariableStatement extends Ast<ts.VariableStatement> implements Exportable {
    get evaluationType(): EvaluationType;
    get variables(): Variable[];
    get isExported(): boolean;
}
export declare class Variable extends Ast<VariableDeclaration> {
    get evaluationType(): EvaluationType;
    get name(): string;
    get expression(): Expression<ts.Node> | undefined;
}
