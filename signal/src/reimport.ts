import { comptime, macro } from "./reexports.js";

export const foo = comptime(() => 42);

const test = () => { };

export const bar = comptime.fn((ctx) => {
	return ctx.syntax.call(ctx.syntax.ref(test));
});

export const gen = macro.generate((_) => {
	return class { }
});

export const attr = macro.attribute(() => {

});