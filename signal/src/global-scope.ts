
import { ReactiveObserver, ReactiveSource, Unsubscriber } from "./reactive.js";
import { ScopeEvent, ScopeEventType } from "./scope.js";
import { Slot, SlotData } from "./slot.js";

export class GlobalScope implements ReactiveObserver {
	static readonly #instance = new GlobalScope();

	public static get(): GlobalScope {
		return this.#instance;
	}

	readonly #eventHandlers: GlobalScopeEventHandler[] = [];
	readonly #slots: Record<string, Slot> = {};
	readonly #queue: ScopeEvent<ScopeEventType>[] = [];
	#hasQueuedPending = false;
	#isFlushing = false;

	private constructor() { }

	// @internal
	public invalidate(): void {
		if (this.#hasQueuedPending)
			return;

		this.#hasQueuedPending = true;
		this.#queue.push({ type: ScopeEvent.Pending, data: {} });
	}

	// @internal
	public track(_source: ReactiveSource): void { }

	// @internal
	public flush(): void {
		if (this.#isFlushing)
			throw new Error("Cannot flush the global scope while it is already flushing.");

		this.#isFlushing = true;
		const errors: unknown[] = [];

		try {
			while (this.#queue.length > 0) {
				const event = this.#queue.shift()!;

				if (event.type === ScopeEvent.Pending)
					this.#hasQueuedPending = false;

				for (const handler of [...this.#eventHandlers]) {
					try {
						handler(event);
					} catch (error) {
						errors.push(error);
					}
				}
			}
		} finally {
			this.#isFlushing = false;
		}

		if (errors.length === 1)
			throw errors[0];

		if (errors.length > 1)
			throw new AggregateError(errors, "Errors occurred while flushing the global scope.");
	}

	public readonly onEvent = (handler: GlobalScopeEventHandler): Unsubscriber => {
		this.#eventHandlers.push(handler);
		return () => this.removeEventHandler(handler);
	}

	// @internal
	public getOrInsertSlot = <T extends SlotData>(id: string, onInsert: () => T): T => {
		if (!this.#slots[id])
			this.#slots[id] = new Slot(onInsert());
		return this.#slots[id].data as T;
	}

	private readonly removeEventHandler = (handler: GlobalScopeEventHandler): boolean => {
		const index = this.#eventHandlers.indexOf(handler);

		if (index === -1)
			return false;

		this.#eventHandlers.splice(index, 1);
		return true;
	}
}

export type GlobalScopeEventHandler = <T extends ScopeEventType>(event: ScopeEvent<T>) => any;
