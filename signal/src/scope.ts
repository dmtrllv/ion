import { Effect } from "./effect.js";
import { Memo } from "./memo.js";
import { Signal, Unsubscriber } from "./signal.js";

export type ScopeClosure<T> = () => T;

let activeScope: Scope<any> | null = null;

export const getActiveScope = () => activeScope as InternalScope | null;

type PriveMethods = "addSlot" | "resolveNextSlot"

export interface InternalScope extends Omit<Scope<any>, PriveMethods> {
	getOrInsertSlot: <T extends SlotData>(id: number, onInsert: () => T) => T;
}

type SlotData = Signal<any> | Effect | Memo<any>;

type SubScriber = () => any;

class Slot {
	public readonly data: SlotData;
	public readonly subscribers: SubScriber[] = [];

	public constructor(data: SlotData) {
		this.data = data;
	}
}

export class Scope<T> {
	readonly #closure: ScopeClosure<T>;
	readonly #eventHandlers: ScopeEventHandler[] = [];
	readonly #slots: (Slot | null)[] = [];

	#isInitialized: boolean = false;

	// @ts-expect-error
	private getOrInsertSlot = <T extends SlotData>(id: number, onInsert: () => T): T => {
		if (!this.#slots[id])
			this.#slots[id] = new Slot(onInsert());
		return this.#slots[id].data as T;
	}

	public get isInitialized(): boolean {
		return this.#isInitialized;
	}

	public constructor(closure: ScopeClosure<T>) {
		this.#closure = closure;
	}

	public run(): T {
		const prev = activeScope;
		try {
			activeScope = this;
			const result = this.#closure();
			activeScope = prev;
			return result;
		} catch(e) {
			throw e;
		} finally {
			this.#isInitialized = true;
		}
	}

	public flush() {

	}

	public readonly onEvent = (handler: ScopeEventHandler): Unsubscriber => {
		this.#eventHandlers.push(handler);
		return () => this.removeEventHandler(handler);
	}

	private readonly removeEventHandler = (handler: ScopeEventHandler) => {
		const index = this.#eventHandlers.indexOf(handler);
		const found = index > -1;
		if (found)
			this.#eventHandlers.splice(index, 1);
		return found;
	}
}

type ScopeEventHandler = <T extends keyof ScopeEvents>(event: { readonly type: T, readonly data: ScopeEvents[T] }) => any;

const Invalidate = "INVALIDATE" as const;
const Pending = "PENDING" as const;

export const ScopeEvent = {
	Invalidate,
	Pending,
} as const;

export type ScopeEventType = (typeof ScopeEvent)[keyof typeof ScopeEvent];

type ScopeEvents = {
	[Invalidate]: {},
	[Pending]: {},
};

export const scope = <T>(closure: ScopeClosure<T>): Scope<T> => new Scope(closure);