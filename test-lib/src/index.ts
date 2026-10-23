import { comptime, ast } from "@ion/compiler";

export const macroTest = comptime.macro((ctx, name: ast.StringLiteral) => {
	const { createClass, createFunction, parseExprString } = ctx.ast;

	const constructor = createFunction("constructor", [
		parseExprString(`console.log("Hello, Macros!")`)
	]);

	return createClass({ name, constructor });
});

export const sum = comptime.fn((a: number, b: number) => a + b);

export const hello = () => Date.now();