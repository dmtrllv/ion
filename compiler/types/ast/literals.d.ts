import { Ast } from "./ast.js";
import * as ts from "typescript/ast";
export declare class StringLiteral extends Ast<ts.StringLiteral> {
    get text(): string;
}
