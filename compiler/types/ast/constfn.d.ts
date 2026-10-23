import * as ts from "typescript/ast";
import { EvaluationType } from "./ast.js";
import { Expression } from "./expression.js";
export declare class ConstFnCall extends Expression<ts.CallExpression> {
    get evaluationType(): EvaluationType;
    get declaration(): ConstFn;
}
