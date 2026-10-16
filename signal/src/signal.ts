import { Comptime, comptime } from "@ion/comptime";

class SignalImpl<T> implements Signal<T> {
	// @ts-expect-error
	readonly #id: number;
	// @ts-expect-error
	readonly #value: T;

	public constructor(id: number, value: T) {
		this.#id = id;
		this.#value = value;
	}
	
	public readonly get!: () => T;

	public readonly use!: () => T;

	public readonly set!: (value: T) => T;

	/**
	 * @argument {T} closure is a function that modifies the state inplace, its return type is any
	 * so that inline closures are possible. For example in `list.update(list => list.push("buy milk"))`,
	 * `list.push()` returns a number which is not what the new state will be, the value is mutated in place.
	 * If the value needs to be replaced use `Signal.set(value)`
	 */
	public readonly update!: (closure: (value: T) => any) => T;

	public readonly subscribe!: (observer: (value: T) => any) => Unsubscriber;
}

export interface Signal<T> {
	readonly get: () => T;
	readonly use: () => T;
	readonly set: (value: T) => T;
	readonly update: (closure: (value: T) => any) => T;
	readonly subscribe: (observer: (value: T) => any) => Unsubscriber;
}

export type Unsubscriber = () => void;

const createSignal = <T>(id: number, value: T): Signal<T> => new SignalImpl(id, value);

export const signal = comptime((ctx) => {
	let count = 0;

	// todo: this needs to be checked for export
	// or just let it error on runtime? 
	// then its kinda obvious that createSignal is used without export
	const fnRef = ctx.syntax.ref(createSignal);

	return comptime.fn(<T>(ctx: Comptime.Context, value: Comptime.Expr<T>) => {
		let id = ctx.syntax.literal(count++);
		return ctx.syntax.call<Signal<T>, [number, T]>(fnRef, id, value);
	});
});