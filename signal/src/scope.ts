
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
	readonly #slots: Record<string, Slot> = {};
	readonly #dependencies = new Set<ReactiveSource>();
	readonly #queue: ScopeEvent<ScopeEventType>[] = [];
	#nextDependencies: Set<ReactiveSource> | null = null;
	#result!: T;
	#isInitialized = false;
	#isInvalidated = false;
	#wasInvalidatedWhileRunning = false;
	#isRunning = false;
	#isFlushing = false;
	#hasQueuedInvalidation = false;

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
		if (this.#isRunning)
			this.#wasInvalidatedWhileRunning = true;

		if (this.#isInvalidated)
			return;

		this.#isInvalidated = true;

		if (this.#hasQueuedInvalidation)
			return;

		this.#hasQueuedInvalidation = true;
		this.#queue.push({ type: ScopeEvent.Invalidated, data: {} });
	}

	// @internal
	public track(source: ReactiveSource): void {
		if (this.#nextDependencies === null)
			return;

		this.#nextDependencies.add(source);
		source.addObserver(this);
	}

	public flush(): void {
		if (this.#isFlushing)
			throw new Error("Cannot flush a scope while it is already flushing.");

		this.#isFlushing = true;
		const errors: unknown[] = [];

		try {
			while (this.#queue.length > 0) {
				const event = this.#queue.shift()!;

				if (event.type === ScopeEvent.Invalidated)
					this.#hasQueuedInvalidation = false;

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
			throw new AggregateError(errors, "Errors occurred while flushing a scope.");
	}

	public run(): Result<T> {
		if (this.#isRunning)
			throw new Error("Cannot run a scope while it is already running.");

		if (this.#isInitialized && !this.#isInvalidated)
			return { data: this.#result };

		this.#isRunning = true;
		this.#wasInvalidatedWhileRunning = false;
		this.#isInvalidated = false;

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

			this.#result = result;
			this.#isInitialized = true;
			this.#isInvalidated = this.#wasInvalidatedWhileRunning;

			return { data: result };
		} catch (error) {
			for (const source of nextDependencies) {
				if (!previousDependencies.has(source))
					source.removeObserver(this);
			}

			this.#isInvalidated = true;

			throw error;
		} finally {
			this.#nextDependencies = null;
			this.#isRunning = false;
			activeScope = previousScope;
		}
	}

	// @internal
	public getOrInsertSlot = <T extends SlotData>(id: string, onInsert: () => T): T => {
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
	Invalidated,
	Pending,
} as const;

export type ScopeEventType = (typeof ScopeEvent)[keyof typeof ScopeEvent];

type ScopeEvents = {
	[Invalidated]: {},
	[Pending]: {},
};

export const scope = <T>(closure: ScopeClosure<T>): Scope<T> => new Scope<T>(closure);

export type Result<T> = {
	readonly data: T;
	readonly error?: undefined;
} | {
	readonly data?: undefined;
	readonly error: Error;
};