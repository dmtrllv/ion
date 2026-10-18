import * as ts from "typescript";

const comptimeFnKey = "__ion_comptime_fn__";

type ComptimeFn = {
	readonly [comptimeFnKey]: (
		args: readonly ts.Expression[],
	) => unknown;
};

export type Comptime = {
	<T>(comptimeClosure: (ctx: Comptime.Context) => T): T;

	readonly fn: <R, Args extends any[]>(val: (ctx: Comptime.Context, ...args: ComptimeArgs<Args>) => Comptime.Expr<R>) => (...args: Args) => R;
};

type ComptimeArgs<T extends any[]> = {
	[K in keyof T]: Comptime.Expr<T[K]>;
};

const createContext = (): Comptime.Context => ({
	syntax: {
		createFunction: (_props) => {
			throw new Error("Not implemented");
		},

		literal: <T extends string | number | boolean>(value: T,): Comptime.Expr<T> => {
			return createLiteralExpression(value) as Comptime.Expr<T>;
		},

		parseStatements: (source) => {
			const sourceFile = ts.createSourceFile(
				"comptime.ts",
				source,
				ts.ScriptTarget.Latest,
				true,
				ts.ScriptKind.TS,
			);

			return sourceFile.statements as any;
		},

		call: <T, Args extends any[]>(target: Comptime.Ref<(...args: Args) => T>, ...args: CallArgs<Args>): Comptime.Expr<T> => {
			return ts.factory.createCallExpression(
				target,
				undefined,
				args.map(toExpression),
			) as Comptime.Expr<T>;
		},

		ref: <T>(value: T): Comptime.Ref<T> => {
			if (typeof value !== "function" || !value.name) {
				throw new Error(
					"syntax.ref currently requires a named function",
				);
			}

			const identifier = ts.factory.createIdentifier(
				value.name,
			) as Comptime.Ref<T>;

			Object.defineProperty(identifier, "__ion_comptime_ref__", {
				value: value.name,
			});

			return identifier;
		},
	},

	source: {
		caller: () => {
			throw new Error(
				"Source caller information is not implemented yet",
			);
		},
	},
});

const createLiteralExpression = (value: string | number | boolean): ts.Expression => {
	if (typeof value === "string") {
		return ts.factory.createStringLiteral(value);
	}

	if (typeof value === "number") {
		return ts.factory.createNumericLiteral(value);
	}

	return value ? ts.factory.createTrue() : ts.factory.createFalse();
};

const toExpression = (value: unknown): ts.Expression => {
	if (value !== null && typeof value === "object" && "kind" in value) {
		const node = value as ts.Node;

		if (ts.isExpression(node)) {
			return node;
		}
	}

	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
		return createLiteralExpression(value);
	}

	throw new Error(
		"Unsupported call argument: expected a TypeScript expression or primitive literal",
	);
};

const comptimeWrapper = <T>(comptimeClosure: (ctx: Comptime.Context) => T): T => {
	return comptimeClosure(createContext());
};

const comptimeFn = <R, Args extends any[]>(val: (ctx: Comptime.Context, ...args: ComptimeArgs<Args>) => Comptime.Expr<R>): ((...args: Args) => R) => {
	const wrapper = (() => {
		console.log(new Error(
			"comptime.fn must only be invoked by the compiler",
		));
	}) as ((...args: Args) => R) & ComptimeFn & any;

	wrapper[comptimeFnKey] = (args: any) => {
		return val(
			createContext(),
			...(args as ComptimeArgs<Args>),
		);
	};

	return wrapper;
};

export const comptime: Comptime = Object.assign(comptimeWrapper, {
	fn: comptimeFn,
}) as Comptime;

type CallArgs<Args extends any[]> = {
	[K in keyof Args]: Args[K] | Comptime.Expr<Args[K]>;
};

export namespace Comptime {
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
	};

	export type Syntax = {
		readonly createFunction: (
			props: CreateFunctionProps,
		) => Function;

		readonly literal: <T extends string | number | boolean>(
			value: T,
		) => Expr<T>;

		readonly parseStatements: (
			source: string,
		) => Statement[];

		readonly call: <T, Args extends any[]>(
			target: Ref<(...args: Args) => T>,
			...args: CallArgs<Args>
		) => Expr<T>;

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
}

type Macros = {
	readonly attribute: (...args: any[]) => any;

	readonly generate: <T extends Comptime.Item>(
		generator: (ctx: Comptime.Context) => T,
	) => T;
};

export const macro: Macros = {
	attribute: (..._args: any[]) => ({} as any),

	generate: <T extends Comptime.Item>(
		_generator: (ctx: Comptime.Context) => T,
	): T => ({} as any),
};
