import { GlobalScope } from "./global-scope.js";
import { ReactiveObserver, ReactiveSource, Unsubscriber } from "./reactive.js";
import { Slot, SlotData } from "./slot.js";

export type ScopeClosure<T> = () => T;

let activeScope: Scope<any> | GlobalScope = GlobalScope.get();

// @internal
export const getActiveScope = (): Scope<any> | GlobalScope => activeScope || GlobalScope.get();

export class Scope<T> implements ReactiveObserver {
	readonly #closure: ScopeClosure<T>;
	readonly #eventHandlers: ScopeEventHandler[] = [];
	readonly #slots: Record<number, Slot> = {};

	#isInitialized = false;
	#isInvalidated = false;

	public get isInitialized(): boolean {
		return this.#isInitialized;
	}

	public get isInvalidated(): boolean {
		return this.#isInvalidated;
	}

	public constructor(closure: ScopeClosure<T>) {
		this.#closure = closure;
	}

	// @internal
	public invalidate(): void {
		throw new Error("Method not implemented.");
	}

	// @internal
	public track(source: ReactiveSource): void {

	}

	public flush(): void {

	}

	public run(): T {
		throw new Error("todo");
	}

	// @internal
	public getOrInsertSlot = <T extends SlotData>(id: number, onInsert: () => T): T => {
		if (!this.#slots[id])
			this.#slots[id] = new Slot(onInsert());
		return this.#slots[id].data as T;
	}

	public readonly onEvent = (handler: ScopeEventHandler): Unsubscriber => {
		this.#eventHandlers.push(handler);
		return () => this.removeEventHandler(handler);
	}

	private readonly removeEventHandler = (handler: ScopeEventHandler): boolean => {
		const index = this.#eventHandlers.indexOf(handler);

		if (index === -1)
			return false;

		this.#eventHandlers.splice(index, 1);
		return true;
	}
}

export type ScopeEventHandler = <T extends ScopeEventType>(event: ScopeEvent<T>) => any;

export type ScopeEvent<T extends ScopeEventType> = {
	readonly type: T,
	readonly data: ScopeEvents[T];
};

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

export const scope = <T>(closure: ScopeClosure<T>): Scope<T> => new Scope<T>(closure);