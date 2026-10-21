## Current Limitiations:
- comptime must be declared top level. (This will be relaxed later like inside scopes, but this is more an evaluation thing than initial resolution)
- references to symbols from within a comptime closure to outside, must or be a declaration that wont execute at top level, or a comptime value. Because all top level statements that contains non comptime values/expression will be remove at comptime evaluation. this is to prevent global code to execute (think start a express server).

# 1. comptime
A comptime declaration `comptime(() => { ... })` will be executed at compile time. The variable/symbol will be marked as a comptime value which allows further analysis
to inline that value where ever the variable is used. When a `comptime` closure returns a const function, macro or derive macro the symbol will get that comptime type so that further analysis can determine to use a value or evalue a comptime function.
Some examples:
```ts
export const randomQuote = await comptime(async () => {
	const response = await fetch("https://dummyjson.com/quotes/random");
	const json = await response.json();
	return json.quote as string;
});
// after compilation the js will contain the quote as a string fetched from the url
// export const randomQuote = "The only true wisdom is in knowing you know nothing.";
```

# 2. const functions
A const function `comptime.fn(() => { ... })` will be executed at compile time at every place that function is called. The function call expression ast will be replaced with the comptile time value. One limitiation to the const functions is that it only accepts comptime values as arguments and can return type.

# 3. macro
A macro `comptime.macro((ctx) => { ... })` will be executed at compile time the same as a const function but its arguments are `ast.Expr<T>` types and it must return an `ast.Node`. It also receives a context as first argument which gives access to modify or generate ast.

# What is a valid comptime value type?
It must be something that can be returned from const functions. This means that the returned value must be able to be transformed into an ast tree.
#### valid types:
- primitives (number, string, boolean, null, undefined)
- symbol: this should not be created but use the original reference (maybe add imports etc)
- object: only when the properties are also valid comptime value types
- array: only when their items are also valid comptime values types
- class: ???
- functions: ???