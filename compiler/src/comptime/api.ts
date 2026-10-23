import { Ast } from "../ast/ast.js";
import * as ast from "../ast/index.js";

const comptimeFn = <T>(closure: () => T): T => closure();

const macro = <const T extends Ast, const Args extends readonly ast.Ast[]>(closure: MacroClosure<T, Args>): (...args: MacroArgs<Args>) => MacroResult<T> => (..._args: any[]) => closure as any;
//const derive = <const T extends Ast | void, const Args extends readonly ast.Ast[]>(closure: DeriveClosure<T, Args>): (...args: MacroArgs<Args>) => MacroResult<T> => (..._args: any[]) => closure as any;

const constfn = <T>(closure: (...args: any[]) => T): (...args: any[]) => T => () => closure();

export const comptime = Object.assign(comptimeFn, {
	macro,
	fn: constfn,
	//derive
});

export interface MacroClosure<T, Args extends readonly any[]> {
	(context: MacroContext, ...args: Args): T;
}

export type MacroContext = {
	readonly ast: {
		readonly createClass: (props: CreateClassProps) => ast.Class;
		readonly createFunction: (name: string | ast.StringLiteral, statements: (ast.Statement | ast.Expression)[]) => ast.Function;
		readonly parseExprString: (source: string) => ast.Expression;

		readonly addMethod: (target: ast.Class, method: ast.Function) => ast.Class;
	}
};

export interface DeriveClosure<T, Args extends readonly any[]> {
	(context: DeriveContext, ...args: Args): T;
}

export type DeriveContext = {
	readonly ast: {
		readonly createClass: (props: CreateClassProps) => ast.Class;
		readonly createFunction: (name: string | ast.StringLiteral, statements: (ast.Statement | ast.Expression)[]) => ast.Function;
		readonly parseExprString: (source: string) => ast.Expression;
	}
	readonly target: ast.Class;
}

export type CreateClassProps = {
	name: string | ast.StringLiteral;
	generics?: any[];
	constructor?: any;
	properties?: [string | number | ast.StringLiteral, any][];
}

type MacroResult<T> =
	T extends ast.Class ? new (...args: any[]) => any :
	T extends ast.Function ? (...args: any[]) => any :
	T extends ast.StringLiteral ? string :
	unknown;

type MacroArgs<T extends readonly any[]> = {
	readonly [K in keyof T]: MacroResult<T[K]>
};