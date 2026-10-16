import * as ts from "typescript";
export type Comptime = {
    <T>(comptimeClosure: (ctx: Comptime.Context) => T): T;
    readonly fn: <R, Args extends any[]>(val: (ctx: Comptime.Context, ...args: ComptimeArgs<Args>) => Comptime.Expr<R>) => (...args: Args) => R;
};
type ComptimeArgs<T extends any[]> = {
    [K in keyof T]: Comptime.Expr<T[K]>;
};
export declare const comptime: Comptime;
type CallArgs<Args extends any[]> = {
    [K in keyof Args]: Args[K] | Comptime.Expr<Args[K]>;
};
export declare namespace Comptime {
    export type Function = ts.FunctionDeclaration;
    export type Class = ts.ClassDeclaration;
    export type Statement = ts.Statement;
    export type Expr<T> = ts.Expression & {
        readonly __type?: T;
    };
    export type Ref<T> = ts.Identifier & {
        readonly __type?: T;
        readonly __ion_comptime_ref__?: string;
    };
    export type Item = Function | Class | Statement | Expr<any>;
    export type CallProps = {};
    type CreateFunctionProps = {};
    export type Context = {
        readonly syntax: Syntax;
        readonly source: Source;
    };
    export type Syntax = {
        readonly createFunction: (props: CreateFunctionProps) => Function;
        readonly literal: <T extends string | number | boolean>(value: T) => Expr<T>;
        readonly parseStatements: (source: string) => Statement[];
        readonly call: <T, Args extends any[]>(target: Ref<(...args: Args) => T>, ...args: CallArgs<Args>) => Expr<T>;
        readonly ref: <T>(value: T) => Ref<T>;
    };
    export type Source = {
        readonly caller: () => Location;
    };
    export type Location = {
        readonly id: string;
        readonly file: string;
        readonly module: string;
        readonly line: number;
        readonly column: number;
    };
    export {};
}
type Macros = {
    readonly attribute: (...args: any[]) => any;
    readonly generate: <T extends Comptime.Item>(generator: (ctx: Comptime.Context) => T) => T;
};
export declare const macro: Macros;
export {};
