import { Comptime, comptime } from "@ion/comptime";
import { getActiveScope } from "./scope.js";

export class SignalImpl<T> implements Signal<T> {
	readonly #id: number;
	#value: T;

	public constructor(id: number, value: T) {
		this.#id = id;
		this.#value = value;
	}

	public readonly get = (): T => {
		return this.#value;
	};

	public readonly inspect = (): T => {
		return this.#value;
	}

	public readonly set = (value: T) => {
		this.#value = value;
	}

	/**
	 * @argument {T} closure is a function that modifies the state inplace, its return type is any
	 * so that inline closures are possible. For example in `list.update(list => list.push("buy milk"))`,
	 * `list.push()` returns a number which is not what the new state will be, the value is mutated in place.
	 * If the value needs to be replaced use `Signal.set(value)`
	 */
	public readonly update = (closure: (value: T) => any) => {
		this.set(closure(this.get()));
	};

	public readonly subscribe = (_observer: (value: T) => any): Unsubscriber => {
		return () => false;
	};

	public readonly toJSON = () => {
		return {
			id: this.#id,
			value: this.#value,
		}
	}
}

export interface Signal<T> {
	readonly get: () => T;
	readonly inspect: () => T;
	readonly set: (value: T) => void;
	readonly update: (closure: (value: T) => any) => void;
	readonly subscribe: (observer: (value: T) => any) => Unsubscriber;
	readonly toJSON: () => { readonly id: number, readonly value: Readonly<T> };
}

export type Unsubscriber = () => boolean;

// TODO: compiler fix
// this gets removed in comptime module output for some reason...
// or it thinks this has a top level execution somewhere
// or its a syntax symbol rewrite issue 
// or an import resolution issue
export const createSignal = <T>(id: number, value: T): Signal<T> => {
	const scope = getActiveScope();
	if (scope === null) {
		throw new Error(`Reactives only work inside a scope!`);
	}
	return scope.getOrInsertSlot(id, () => new SignalImpl(id, value));
};

export const signal = comptime((ctx) => {
	let count = 0;

	const fnRef = ctx.syntax.ref(createSignal);

	return comptime.fn(<T>(ctx: Comptime.Context, value: Comptime.Expr<T>) => {
		const id = ctx.syntax.literal(count++);
		return ctx.syntax.call<Signal<T>, [number, T]>(fnRef, id, value);
	});
});