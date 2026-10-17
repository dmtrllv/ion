import { effect, scope, ScopeEvent, signal } from "@ion/signal";

const app = scope(() => {
	const title = signal("todos");
	const todos = signal([
		"Wake up",
		"Eat",
		"Code",
		"Sleep?"
	]);

	effect(() => {
		console.log(todos.get());

		if (!todos.get().length)
			return;

		const timeout = setTimeout(() => {
			todos.update(list => list.splice(0, 1));
		}, 1000);

		return () => clearTimeout(timeout);
	});

	return {
		addTodo: (item: string) => todos.update(list => list.push(item)),
		removeTodo: (index: number) => todos.update(list => list.splice(index)),
		setTitle: (t: string) => title.set(t),
		todos: todos.inspect()
	};
});

app.onEvent((e) => {
	switch (e.type) {
		case ScopeEvent.Invalidated:
			console.log("invalidated, rerun...");
			app.run();
			break;
		case ScopeEvent.Pending:
			console.log("got pending, flush...");
			app.flush();
			break;
	}
});

const { data, error } = app.run();

if (data) {
	data.addTodo("test");
} else {
	console.log(error);
}
