import * as ts from "typescript/ast";
import { Ast, EvaluationType } from "./ast.js";
export declare abstract class Expression<T extends ts.Node = ts.Node> extends Ast<T> {
}
export declare class FunctionCall extends Expression<ts.CallExpression> {
    get evaluationType(): EvaluationType;
    get arguments(): Expression<ts.Node>[];
    get declaration(): Ast<any>;
}
