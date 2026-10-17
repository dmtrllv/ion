import { Comptime, comptime } from "@ion/comptime";
import { getActiveScope } from "./scope.js";
import { ReactiveObserver, trackDependency, Unsubscriber } from "./reactive.js";

export class SignalImpl<T> implements Signal<T> {
	readonly #id: number;
	readonly #observers = new Set<ReactiveObserver>();
	readonly #subscribers = new Set<(value: T) => any>();
	#value: T;

	public constructor(id: number, value: T) {
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

export interface Signal<T> {
	readonly get: () => T;
	readonly inspect: () => T;
	readonly set: (value: T) => void;
	readonly update: (closure: (value: T) => any) => void;
	readonly subscribe: (observer: (value: T) => any) => Unsubscriber;
	readonly toJSON: () => { readonly id: number, readonly value: Readonly<T> };
}

export const createSignal = <T>(id: number, value: T): Signal<T> => {
	return getActiveScope().getOrInsertSlot(id, () => new SignalImpl(id, value));
};

export const signal = comptime((ctx) => {
	let count = 0;

	const fnRef = ctx.syntax.ref(createSignal);

	return comptime.fn(<T>(ctx: Comptime.Context, value: Comptime.Expr<T>) => {
		const id = ctx.syntax.literal(count++);
		return ctx.syntax.call<Signal<T>, [number, T]>(fnRef, id, value);
	});
});