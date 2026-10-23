import { comptime, ast } from "@ion/compiler";

const foo = 123; // decl + assignment -> check assignment for constant evaluation or comptime (const.fn result or macro expansion)

// class decl -> check static properties
class Foo {

}

// function decl -> no checks needed
function bar() {

}

// macro decl -> no checks needed
const macroTest = comptime.macro((ctx, name: ast.StringLiteral) => {
	const { createClass, createFunction, parseExprString } = ctx.ast;

	const constructor = createFunction("constructor", [
		parseExprString(`console.log("Hello, Macros!")`)
	]);

	return createClass({ name, constructor });
});

// decl + comptime expr
export const test = comptime(() => 1 + 2);

// decl + macro expansion call
const Class = macroTest("Test");

// expression -> check if constant evaluation is possible
new Class();