import { GlobalScope } from "./global-scope.js";
import { ReactiveObserver, ReactiveSource, Unsubscriber, withObserver } from "./reactive.js";
import { Slot, SlotData } from "./slot.js";

export type ScopeClosure<T> = () => T;

let activeScope: Scope<any> | GlobalScope = GlobalScope.get();

// @internal
export const getActiveScope = (): Scope<any> | GlobalScope => activeScope || GlobalScope.get();

export class Scope<T> implements ReactiveObserver {
	readonly #closure: ScopeClosure<T>;
	readonly #eventHandlers: ScopeEventHandler[] = [];
	readonly #slots: Record<number, Slot> = {};
	readonly #dependencies = new Set<ReactiveSource>();
	#nextDependencies: Set<ReactiveSource> | null = null;
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
		if (this.#nextDependencies === null)
			return;

		this.#nextDependencies.add(source);
		source.addObserver(this);
	}

	public flush(): void {

	}

	public run(): T {
		const previousScope = activeScope;

		const previousDependencies = this.#dependencies;
		const nextDependencies = new Set<ReactiveSource>();

		activeScope = this;
		
		this.#nextDependencies = nextDependencies;

		try {
			const result = withObserver(this, this.#closure);

			for (const source of previousDependencies) {
				if (!nextDependencies.has(source))
					source.removeObserver(this);
			}

			this.#dependencies.clear();

			for (const source of nextDependencies) {
				this.#dependencies.add(source);
			}

			this.#isInitialized = true;
			this.#isInvalidated = false;

			return result;
		} catch (error) {
			for (const source of nextDependencies) {
				if (!previousDependencies.has(source))
					source.removeObserver(this);
			}

			throw error;
		} finally {
			this.#nextDependencies = null;
			activeScope = previousScope;
		}
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

const Invalidated = "INVALIDATED" as const;
const Pending = "PENDING" as const;

export const ScopeEvent = {
	Invalidate: Invalidated,
	Pending,
} as const;

export type ScopeEventType = (typeof ScopeEvent)[keyof typeof ScopeEvent];

type ScopeEvents = {
	[Invalidated]: {},
	[Pending]: {},
};

export const scope = <T>(closure: ScopeClosure<T>): Scope<T> => new Scope<T>(closure);