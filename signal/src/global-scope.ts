
import { ReactiveObserver, ReactiveSource, Unsubscriber } from "./reactive.js";
import { Scope, ScopeEvent, ScopeEventType } from "./scope.js";
import { Slot, SlotData } from "./slot.js";

export class GlobalScope implements ReactiveObserver {
	static readonly #instance = new GlobalScope();
	
	public static get(): GlobalScope {
		return this.#instance;
	}
	
	readonly #eventHandlers: GlobalScopeEventHandler[] = [];
	readonly #slots: Record<string, Slot> = {};
	readonly #queue: ScopeEvent<ScopeEventType>[] = [];
	readonly #children = new Set<Scope<any>>();
	
	#hasQueuedPending = false;
	#isFlushing = false;
	#isDisposed: boolean = false;

	private constructor() { }

	//
	public get isDisposed(): boolean {
		return this.#isDisposed;
	}

	// @internal
	public invalidate(): void {
		if (this.#hasQueuedPending)
			return;

		this.#hasQueuedPending = true;
		this.#queue.push({ type: ScopeEvent.Pending, data: {} });
	}

	// @internal 
	public addChild(scope: Scope<any>) {
		this.#children.add(scope);
	}

	// @internal 
	public removeChild(scope: Scope<any>) {
		this.#children.delete(scope);
	}

	// @internal
	public track(_source: ReactiveSource): void { }

	// @internal
	public flush(): void {
		if (this.#isFlushing)
			throw new Error("Cannot flush the global scope while it is already flushing.");

		this.#isFlushing = true;
		const errors: Error[] = [];

		try {
			while (this.#queue.length) {
				const event = this.#queue.shift()!;

				if (event.type === ScopeEvent.Pending)
					this.#hasQueuedPending = false;

				for (const handler of [...this.#eventHandlers]) {
					try {
						handler(event);
					} catch (error) {
						errors.push(toError(error));
					}
				}
			}
		} finally {
			this.#isFlushing = false;
		}

		if (errors.length === 1)
			throw errors[0];

		if (errors.length > 1)
			throw new AggregateError(errors, "Multiple global scope event handlers failed.");
	}

	public onEvent(handler: GlobalScopeEventHandler): Unsubscriber {
		this.#eventHandlers.push(handler);

		return () => {
			const index = this.#eventHandlers.indexOf(handler);

			if (index === -1)
				return false;

			this.#eventHandlers.splice(index, 1);
			return true;
		};
	}

	// @internal
	public getOrInsertSlot<T extends SlotData>(id: string, onInsert: () => T): T {
		let slot = this.#slots[id];

		if (!slot) {
			slot = new Slot(onInsert());
			this.#slots[id] = slot;
		}

		return slot.data as T;
	}

	public dispose(): void {
		if (this.#isDisposed)
			return;

		if (this.#isFlushing)
			throw new Error("Cannot dispose a scope while it is running or flushing.");

		this.#isDisposed = true;

		const errors: Error[] = [];

		for (const child of [...this.#children]) {
			try {
				child.dispose();
			} catch (error) {
				errors.push(toError(error));
			}
		}

		this.#children.clear();

		for (const id of Object.keys(this.#slots))
			delete this.#slots[id];

		this.#hasQueuedPending = false;
		this.#eventHandlers.length = 0;

		if (errors.length === 1)
			throw errors[0];

		if (errors.length > 1)
			throw new AggregateError(errors, "Multiple reactive computations failed during scope disposal.");
	}
}

export type GlobalScopeEventHandler = <T extends ScopeEventType>(event: ScopeEvent<T>) => any;

const toError = (error: unknown): Error =>
	error instanceof Error ? error : new Error(String(error));
