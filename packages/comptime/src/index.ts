import * as ts from "typescript";
import { Reflect } from "./reflect.js";
export { type Reflect, reflectContext } from "./reflect.js";

declare global {
	const __IS_COMPTIME__: boolean;
}

export type Comptime = {
	<T>(comptimeClosure: () => T): T;

	readonly fn: <R extends ComptimeValue, Args extends any[]>(val: (...args: Args) => R) => (...args: Args) => R;
	readonly macro: <R, Args extends any[]>(val: (ctx: Comptime.Context, ...args: MacroArgs<Args>) => Comptime.Expr<R>) => (...args: Args) => R;
};

type ComptimeValue = any;

type MacroArgs<T extends any[]> = {
	[K in keyof T]: Comptime.Expr<T[K]>;
};

type CallArgs<Args extends any[]> = {
	[K in keyof Args]: Args[K] | Comptime.Expr<Args[K]>;
};

const comptimeWrapper = <T>(comptimeClosure: () => T): T => {
	if (!__IS_COMPTIME__)
		throw new Error("Whoops comptime call is not removed");
	return comptimeClosure();
};

const macro = <R, Args extends any[]>(val: (ctx: Comptime.Context, ...args: MacroArgs<Args>) => Comptime.Expr<R>): ((...args: Args) => R) => {
	const wrapper = (() => {
		console.log(new Error("macro must only be invoked by the compiler"));
	}) as any;

	wrapper["__COMPTIME_MACRO_FN__"] = val;

	return wrapper;
};

const constfn = <R, Args extends any[]>(closure: (...args: Args) => R): ((...args: Args) => R) => {
	if (!__IS_COMPTIME__)
		throw new Error("Whoops const fn call is not removed");
	return closure;
}

export const comptime: Comptime = Object.assign(comptimeWrapper, {
	fn: constfn,
	macro
}) as Comptime;

export namespace Comptime {
	export type Function = ts.FunctionDeclaration;
	export type Class = ts.ClassDeclaration;
	export type Statement = ts.Statement;

	export type Expr<T> = ts.Expression & {
		readonly __type: T;
	};

	export type Item =
		| Function
		| Class
		| Statement
		| Expr<any>;

	export type CallProps = {};

	type CreateFunctionProps = {};

	export type Context = {
		readonly syntax: Syntax;
		readonly source: Source;
		readonly reflect: Reflect;
	};

	export type Syntax = {
		readonly createFunction: (props: CreateFunctionProps) => Function;
		readonly literal: <T extends string | number | boolean>(value: T,) => Expr<T>;
		readonly parseExpr: (source: string) => Expr<any>;
		readonly call: <T, Args extends any[]>(target: (...args: Args) => T, ...args: CallArgs<Args>) => Expr<T>;
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
}