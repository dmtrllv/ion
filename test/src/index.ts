
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

const result = app.run();

if (result.error) {
	console.error("Initial scope execution failed:", result.error);
} else {
	result.data.addTodo("test");
	process();
}
