import { comptime, ast } from "@ion/compiler";

const foo = 123;

class Foo {

}

function bar() {
	
}

const macroTest = comptime.macro(function(name: ast.StringLiteral) {
	const { createClass, createFunction, parseExprString } = this.ast;

	const constructor = createFunction("constructor", [
		parseExprString(`console.log("Hello, Macros!")`)
	]);

	return createClass({ name, constructor });
});

export const test = comptime(() => 1 + 2);

const Class = macroTest("Test");

new Class();

