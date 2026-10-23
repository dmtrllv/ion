import * as ts from "typescript/ast";
import { EvaluationType, Expression } from "./expression.js";
export declare class MacroCall extends Expression<ts.CallExpression> {
    get evaluationType(): EvaluationType;
    get declaration(): Macro;
}
