import { Ast, EvaluationType } from "./ast.js";
import * as ts from "typescript/ast";
export declare class StringLiteral extends Ast<ts.StringLiteral> {
    get evaluationType(): EvaluationType;
    get text(): string;
}
