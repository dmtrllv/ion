import { ReactiveObserver, ReactiveSource, Unsubscriber } from "./reactive.js";
import { ScopeEvent, ScopeEventType } from "./scope.js";
import { Slot, SlotData } from "./slot.js";

export class GlobalScope implements ReactiveObserver {
	static readonly #instance = new GlobalScope();

	public static get() {
		return this.#instance;
	}

	readonly #eventHandlers: GlobalScopeEventHandler[] = [];
	readonly #slots: Record<number, Slot> = {};

	private constructor() { }

	// @internal
	public invalidate(): void {
		throw new Error("Method not implemented.");
	}

	// @internal
	public track(source: ReactiveSource): void {
		throw new Error("Method not implemented.");
	}

	public flush(): void {
		throw new Error("Method not implemented.");
	}

	public run(): void {
		throw new Error("Method not implemented.");
	}

	public onEvent = (handler: GlobalScopeEventHandler): Unsubscriber => {
		return () => false;
	}

	// @internal
	public getOrInsertSlot = <T extends SlotData>(id: number, onInsert: () => T): T => {
		if (!this.#slots[id])
			this.#slots[id] = new Slot(onInsert());
		return this.#slots[id].data as T;
	}

}

export type GlobalScopeEventHandler = <T extends ScopeEventType>(event: ScopeEvent<T>) => any;