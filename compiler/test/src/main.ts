import { config } from "./config.js";
import { hello } from "./hello.js";
import { signal } from "@ion/signal";

const foo = signal("Hello!");
const bar = signal("bye!");
const coffee = signal(0xCAFEBABE);
const todos = signal<string[]>([]);

console.log(foo.get());
console.log(bar.set("Sayonara!"));
console.log(coffee.set(0xDEADBEEF));
console.log(todos.update(t => t.push()));
// generates:
// const foo = createSignal(0, "Hello!");
// const bar = createSignal(1, "bye!");
// const coffee = signal(2, 0xCAFEBABE);
// NOTE: macro evaluation ordering over the module boundary is undeterministic



if(config.debug) {
	console.log("Debuggin...");
	console.log(hello())
}
// will be replaced by if(true)
// maybe its possible to do extra passes that remove or unwrap conditional branches