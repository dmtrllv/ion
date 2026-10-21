
import { comptime } from "@ion/comptime";
import { effect, scope, ScopeEvent, signal } from "@ion/signal";

export const randomQuote = await comptime(async () => {
	const json = await fetch("https://dummyjson.com/quotes/random").then(r => r.json());
	return json.quote as string;
});

export const sum = comptime.fn((...args: number[]) => args.reduce((a, b) => a + b, 0));
export const product = comptime.fn((...args: number[]) => args.reduce((a, b) => a * b, 1));

export const test = randomQuote;

export default test;

const a = sum(1, 2, 3, 4, 5);
const b = product(1, 2, 3, 4, 5);

console.log(a, b);

const app = scope(() => {
	const title = signal("todos");
	const todos = signal([
		"Wake up",
		"Eat",
		"Code",
		"Sleep?"
	]);

	effect(() => {
		console.log(title.get(), todos.get());

		if (!todos.get().length)
			return;

		const timeout = setTimeout(() => {
			todos.update(list => list.splice(0, 1));
			process();
		}, 1000);

		return () => clearTimeout(timeout);
	});

	return {
		addTodo: (item: string) => todos.update(list => list.push(item)),
		removeTodo: (index: number) => todos.update(list => list.splice(index, 1)),
		setTitle: (value: string) => title.set(value),
		todos
	};
});

const process = (): void => {
	try {
		app.flush();
	} catch (error) {
		console.error("Error while processing scope events:", error);
	}
};

app.onEvent(event => {
	switch (event.type) {
		case ScopeEvent.Invalidated: {
			console.log("Invalidated; rerunning scope...");
			const result = app.run();

			if (result.error)
				console.error("Scope execution failed:", result.error);

			break;
		}
		case ScopeEvent.Pending: {
			console.log("Pending effects; executing...");

			app.flush();

			break;
		}
	}
});

app.run();