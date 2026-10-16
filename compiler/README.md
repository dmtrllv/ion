# A typescript compile time compiler

## About
The idea is that everything wrapped in a `comptime` or `comptime.fn` is evaluated at compile time. This creates the possibility to generate and transform the source code
in a controlled way. For now the comptime context just exposes light wrappers around typescript internal api. Later the idea is to add more reflection with type information, generation etc.

## Quick Demo
### Compile time fetch
```ts
const todos = await comptime(() => fetch("/todos.json").then(response => response.json()));
// after compilation the todos will contain the contents of the todos.json file
// no fetch call will ever be made at runtime
```

### Compile time counter
```ts
export const next = comptime(() => {
	let count = 0;
	return comptime.fn((ctx: Comptime.Context) => ctx.syntax.literal(count++));
});


// foo.ts
import { next } from "./next";

const foo = next(); // generates `const foo = 0;`


// foo.ts
import { next } from "./next";

const bar = next(); // generates `const bar = 1;`
```
Since all comptime evaluation is done in the same nodejs process, the count variable will be preserved between module calls.
One thing to note is that the evaluation order is undeterministic. The compiler iterates all files, walks the ast and evaluates comptime functions.