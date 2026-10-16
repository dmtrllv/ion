export declare const comptime: {
    <T extends Comptime.Item>(comptimeClosure: (ctx: Comptime.Context) => T): T;
    readonly fn: <R, Args extends any[]>(val: (ctx: Comptime.Context, ...args: Args) => Comptime.Expr<R>) => (...args: Args) => R;
};
export declare const macro: {
    readonly attribute: (...args: any) => any;
    readonly generate: <T extends Comptime.Item>(generator: (ctx: Comptime.Context) => T) => Comptime.Generated<T>;
};
export declare namespace Comptime {
    export type Function = {};
    export type Class = {};
    export type Statement = {};
    export type Expr<T> = {
        _phantom: T;
    };
    export type Ref<T> = {
        _phantom: T;
    };
    export type Item = Function | Class | Statement | Expr<any>;
    export type Generated<T> = T extends Function ? (...args: any[]) => any : T extends Class ? new (...args: any) => any : void;
    export type CallProps = {};
    export type Context = {
        readonly syntax: Syntax;
        readonly source: Source;
    };
    type CreateFunctionProps = {};
    export type Syntax = {
        readonly createFunction: (props: CreateFunctionProps) => Function;
        readonly literal: <T extends string | number | boolean>(val: T) => Expr<T>;
        readonly parseStatements: (source: string) => Statement[];
        readonly call: <T, Args extends any[]>(target: Ref<(...args: Args) => T>, ...args: CallArgs<Args>) => Expr<T>;
        readonly ref: <T>(val: T) => Ref<T>;
    };
    type CallArgs<Args extends any[]> = {
        [K in keyof Args]: Args[K] | Expr<Args[K]>;
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
