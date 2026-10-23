import { Ast } from "../ast/ast.js";
import * as ast from "../ast/index.js";
declare const comptimeFn: <T>(closure: () => T) => T;
declare const macro: <const T extends Ast, const Args extends readonly ast.Ast[]>(closure: MacroClosure<T, Args>) => (...args: MacroArgs<Args>) => MacroResult<T>;
declare const constfn: <const T, const Args extends readonly any[]>(closure: (...args: Args) => T) => (...args: Args) => T;
export declare const comptime: typeof comptimeFn & {
    macro: typeof macro;
    fn: typeof constfn;
};
export interface MacroClosure<T, Args extends readonly any[]> {
    (context: MacroContext, ...args: Args): T;
}
export type MacroContext = {
    readonly ast: {
        readonly createClass: (props: CreateClassProps) => ast.Class;
        readonly createFunction: (name: string | ast.StringLiteral, statements: (ast.Statement | ast.Expression)[]) => ast.Function;
        readonly parseExprString: (source: string) => ast.Expression;
        readonly addMethod: (target: ast.Class, method: ast.Function) => ast.Class;
    };
};
export interface DeriveClosure<T, Args extends readonly any[]> {
    (context: DeriveContext, ...args: Args): T;
}
export type DeriveContext = {
    readonly ast: {
        readonly createClass: (props: CreateClassProps) => ast.Class;
        readonly createFunction: (name: string | ast.StringLiteral, statements: (ast.Statement | ast.Expression)[]) => ast.Function;
        readonly parseExprString: (source: string) => ast.Expression;
    };
    readonly target: ast.Class;
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
