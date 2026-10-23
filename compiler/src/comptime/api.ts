import { Ast } from "../ast/ast.js";
import * as ast from "../ast/index.js";

const comptimeFn = <T>(closure: () => T): T => closure();

const macro = <const T extends Ast, const Args extends readonly ast.Ast[]>(closure: MacroClosure<T, Args>): (...args: MacroArgs<Args>) => MacroResult<T> => (..._args: any[]) => closure as any;

const constfn = <T>(closure: (...args: any[]) => T): (...args: any[]) => T => () => closure();

export const comptime = Object.assign(comptimeFn, {
	macro,
	fn: constfn
});

export interface MacroClosure<T, Args extends readonly any[]> {
	(this: MacroContext, ...args: Args): T;
}

export type MacroContext = {
	ast: {
		createClass: (props: CreateClassProps) => ast.Class;
		createFunction: (name: string | ast.StringLiteral, statements: (ast.Statement | ast.Expression)[]) => ast.Function;
		parseExprString: (source: string) => ast.Expression;
	}
};

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