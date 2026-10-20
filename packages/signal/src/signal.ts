import { Comptime, comptime } from "@ion/comptime";
import { getActiveScope } from "./scope.js";
import { ReactiveObserver, trackDependency, Unsubscriber } from "./reactive.js";

export class Signal<T> {
	readonly #id: string;
	readonly #observers = new Set<ReactiveObserver>();
	readonly #subscribers = new Set<(value: T) => any>();
	#value: T;

	public constructor(id: string, value: T) {
		this.#id = id;
		this.#value = value;
	}

	public readonly get = (): T => {
		trackDependency(this);
		return this.#value;
	};

	public readonly inspect = (): T => {
		return this.#value;
	};

	public readonly set = (value: T): void => {
		if (Object.is(this.#value, value))
			return;

		this.#value = value;
		this.notify();
	};

	public readonly update = (closure: (value: T) => any): void => {
		closure(this.#value);
		this.notify();
	};

	public readonly subscribe = (observer: (value: T) => any): Unsubscriber => {
		this.#subscribers.add(observer);

		return () => this.#subscribers.delete(observer);
	};

	public addObserver(observer: ReactiveObserver): void {
		this.#observers.add(observer);
	}

	public removeObserver(observer: ReactiveObserver): void {
		this.#observers.delete(observer);
	}

	private readonly notify = (): void => {
		for (const observer of [...this.#observers]) {
			observer.invalidate();
		}

		for (const subscriber of [...this.#subscribers]) {
			subscriber(this.#value);
		}
	};

	public readonly toJSON = () => ({
		id: this.#id,
		value: this.#value,
	});
}

export const createSignal = <T>(id: string, value: T): Signal<T> => {
	return getActiveScope().getOrInsertSlot(id, () => new Signal(id, value));
};

export const signal = comptime(() => {
	let count = 0;

	return comptime.macro(<T>(ctx: Comptime.Context, value: Comptime.Expr<T>) => {
		const id = ctx.syntax.literal("signal_" + count++);
		return ctx.syntax.call<Signal<T>, [string, T]>(createSignal, id, value);
	});
});

export const test = comptime.fn(() => {

});