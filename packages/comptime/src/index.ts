import * as ts from "typescript";
import { Reflect } from "./reflect.js";
export { type Reflect, reflectContext } from "./reflect.js";

export type Comptime = {
	<T>(comptimeClosure: (ctx: Comptime.Context) => T): T;

	readonly fn: <R extends ComptimeValue, Args extends any[]>(val: (ctx: Comptime.Context, ...args: Args) => R) => (...args: Args) => R;
	readonly macro: <R, Args extends any[]>(val: (ctx: Comptime.Context, ...args: MacroArgs<Args>) => Comptime.Expr<R>) => (...args: Args) => R;
};

//type ComptimeArgs<T extends any[]> = {
//	[K in keyof T]: ComptimeArg<T[K]>;
//};

type ComptimeValue = any; 

type MacroArgs<T extends any[]> = {
	[K in keyof T]: Comptime.Expr<T[K]>;
};

type CallArgs<Args extends any[]> = {
	[K in keyof Args]: Args[K] | Comptime.Expr<Args[K]>;
};

declare global {
	let __NEXT_COMPTIME_CONTEXT__: (id: string) => Comptime.Context & { setResult: (id: string, value: any) => void };
}

const comptimeWrapper = <T>(comptimeClosure: (ctx: Comptime.Context) => T, id: string): T => {
	const context = __NEXT_COMPTIME_CONTEXT__(id);
	const result = comptimeClosure(context);
	context.setResult(id, result);
	return result;
};

const macro = <R, Args extends any[]>(val: (ctx: Comptime.Context, ...args: MacroArgs<Args>) => Comptime.Expr<R>): ((...args: Args) => R) => {
	const wrapper = (() => {
		console.log(new Error("macro must only be invoked by the compiler"));
	}) as any;

	wrapper["__ion_macro__"] = (ctx: Comptime.Context, args: any) => val(ctx, ...(args as MacroArgs<Args>));

	return wrapper;
};

const constfn = <R, Args extends any[]>(_val: (ctx: Comptime.Context, ...args: Args) => R): ((...args: Args) => R) => {
	throw new Error("Not implemented");
	//const wrapper = (() => {
	//	console.log(new Error("constfn must only be invoked by the compiler"));
	//}) as any;

	//wrapper["__ion_const_fn__"] = (args: any) => val(createContext(), ...args);

	//return wrapper;
};

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