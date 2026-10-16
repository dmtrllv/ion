import { comptime, macro } from "@ion/comptime";

// test will contain a value after compilation.
// Date.now will never be called on the runtime.
// The problem:
// Should this now just be a number?
// const test = 1792084835828;
// or should it be a Comptime.Value<number>?
// When its a Comptime.Value<number> it can be replaced directly at the places its used by its value.
// What are the consequences if it will be replaces are every source location it is used?
const test = comptime(() => Date.now());

console.log(test);
// example
// console.log(1792084835828);

// this will generate a function when compiling
// something like this
// const hello = () => { return "Hello"; };
export const hello = macro.generate((ctx) => {
	return ctx.syntax.createFunction({
		name: "hello",
		parameters: [],
		returnType: "string",
		body: ctx.syntax.parseStatements(`
			return "Hello";
		`),
	});
});