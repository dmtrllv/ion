import { Ast } from "../ast/ast.js";
import * as ast from "../ast/index.js";
declare const comptimeFn: <T>(closure: () => T) => T;
declare const macro: <const T extends Ast, const Args extends readonly ast.Ast[]>(closure: MacroClosure<T, Args>) => (...args: MacroArgs<Args>) => MacroResult<T>;
declare const constfn: <T>(closure: (...args: any[]) => T) => (...args: any[]) => T;
export declare const comptime: typeof comptimeFn & {
    macro: typeof macro;
    fn: typeof constfn;
};
export interface MacroClosure<T, Args extends readonly any[]> {
    (this: MacroContext, ...args: Args): T;
}
export type MacroContext = {
    ast: {
        createClass: (props: CreateClassProps) => ast.Class;
        createFunction: (name: string | ast.StringLiteral, statements: (ast.Statement | ast.Expression)[]) => ast.Function;
        parseExprString: (source: string) => ast.Expression;
    };
};
export type CreateClassProps = {
    name: string | ast.StringLiteral;
    generics?: any[];
    constructor?: any;
    properties?: [string | number | ast.StringLiteral, any][];
};
type MacroResult<T> = T extends ast.Class ? new (...args: any[]) => any : T extends ast.Function ? (...args: any[]) => any : T extends ast.StringLiteral ? string : unknown;
type MacroArgs<T extends readonly any[]> = {
    readonly [K in keyof T]: MacroResult<T[K]>;
};
export {};
