import { comptime } from "@ion/compiler";
export const macroTest = comptime.macro((ctx, name) => {
    const { createClass, createFunction, parseExprString } = ctx.ast;
    const constructor = createFunction("constructor", [
        parseExprString(`console.log("Hello, Macros!")`)
    ]);
    return createClass({ name, constructor });
});
export const sum = comptime.fn((a, b) => a + b);
