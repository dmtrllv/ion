import { Comptime } from "./index.js";
export declare class Syntax {
    readonly createFunction: (props: CreateFunctionProps) => Comptime.Function;
    readonly literal: <T extends string | number | boolean>(val: T) => Comptime.Expr<T>;
    readonly parseStatements: (source: string) => Comptime.Statement[];
    readonly call: <T, Args extends any[]>(target: Comptime.Ref<(...args: Args) => T>, ...args: CallArgs<Args>) => Comptime.Expr<T>;
    readonly ref: (string: T) => Comptime.Ref<T>;
}
export type CreateFunctionProps = {
    name: string;
};
export type CallArgs<T extends any[]> = {
    [K in keyof T]: Comptime.Expr<T[K]>;
};
