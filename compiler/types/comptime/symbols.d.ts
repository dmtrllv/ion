import * as ts from "typescript/sync";
import { Compiler } from "../compiler.js";
export type ComptimeSymbols = {
    readonly comptime: ts.Symbol;
    readonly macro: ts.Symbol;
    readonly fn: ts.Symbol;
};
export declare const resolveComptimeSymbols: (compiler: Compiler) => ComptimeSymbols | undefined;
