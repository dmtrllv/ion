import { effect, memo, scope, ScopeEvent, signal } from "@ion/signal";

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

	return memo(() => {
		return {
			addTodo: (item: string) => todos.update(list => list.push(item)),
			removeTodo: (index: number) => todos.update(list => list.splice(index)),
			setTitle: (t: string) => title.set(t),
			todos: todos.inspect()
		};
	});
});

app.onEvent((e) => {
	switch (e.type) {
		case ScopeEvent.Invalidate:
			// the slots values of the scope have changed
			// run the scope again to update its state
			app.run();
			// a ui library can wrap its function components and get an updated ui node back for example
			break;
		case ScopeEvent.Pending:
			// reactive events needs processing (effects, memos, slot changes)
			app.flush();
			break;
	}
});

app.run();
