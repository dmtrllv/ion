import { signal } from "@ion/signal";

const foo = signal("foo");
const bar = signal("bar");

console.log({
	foo: foo.toJSON(),
	bar: bar.toJSON()
});