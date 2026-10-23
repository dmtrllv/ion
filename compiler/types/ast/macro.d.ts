import * as ts from "typescript/ast";
import { Symbol } from "typescript/sync";
import { EvaluationType, Expression } from "./expression.js";
import { Compiler } from "../compiler.js";
export declare const resolveDeclaration: (node: ts.Expression, compiler: Compiler, seen?: Set<Symbol>) => ts.VariableDeclaration | undefined;
export declare const getCallIdentifier: (node: ts.CallExpression) => ts.Identifier | undefined;
export declare class MacroCall extends Expression<ts.CallExpression> {
    get evaluationType(): EvaluationType;
    get declaration(): Macro;
}
export declare const parseComptimeDeclarationType: (node: ts.Node, compiler: Compiler) => "macro" | "fn" | "comptime" | undefined;
