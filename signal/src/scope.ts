
import { Effect } from "./effect.js";
import { GlobalScope } from "./global-scope.js";
import { Memo } from "./memo.js";
import { ReactiveObserver, ReactiveSource, Unsubscriber, withObserver } from "./reactive.js";
import { Slot, SlotData } from "./slot.js";

export type ScopeClosure<T> = () => T;

type ActiveScope = Scope<any> | GlobalScope;

let activeScope: ActiveScope = GlobalScope.get();

// @internal
export const getActiveScope = (): ActiveScope => activeScope;

// @internal
export const withActiveScope = <T>(scope: ActiveScope, closure: () => T): T => {
	const previous = activeScope;
	activeScope = scope;

	try {
		return closure();
	} finally {
		activeScope = previous;
	}
};

export class Scope<T> implements ReactiveObserver {
	readonly #closure: ScopeClosure<T>;
	readonly #eventHandlers: ScopeEventHandler[] = [];
	readonly #slots: Record<string, Slot> = {};
	readonly #dependencies = new Set<ReactiveSource>();

	#nextDependencies: Set<ReactiveSource> | null = null;
	#result!: T;
	#isInitialized = false;
	#isInvalidated = false;
	#wasInvalidatedWhileRunning = false;
	#isRunning = false;
	#isFlushing = false;
	#isEmitting = false;
	#hasQueuedInvalidation = false;
	#hasQueuedPending = false;
	#queuedEvents: ScopeEvent<ScopeEventType>[] = [];

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
		if (this.#isRunning) {
			this.#wasInvalidatedWhileRunning = true;
			return;
		}

		if (this.#isInvalidated)
			return;

		this.#isInvalidated = true;

		if (!this.#hasQueuedInvalidation) {
			this.#hasQueuedInvalidation = true;
			this.#queuedEvents.push({ type: ScopeEvent.Invalidated, data: {} });
		}
	}

	// @internal
	public notifyPending(): void {
		if (this.#hasQueuedPending)
			return;

		this.#hasQueuedPending = true;
		this.#queuedEvents.push({ type: ScopeEvent.Pending, data: {} });
	}

	// @internal
	public track(source: ReactiveSource): void {
		if (!this.#nextDependencies || this.#nextDependencies.has(source))
			return;

		this.#nextDependencies.add(source);
		source.addObserver(this);
	}


	public flush(): void {
		if (this.#isFlushing)
			throw new Error("Cannot flush a scope while it is already flushing.");

		this.#isFlushing = true;
		const errors: Error[] = [];

		try {
			let hasPendingWork: boolean;

			do {
				const slots = Object.values(this.#slots).map(slot => slot.data);
				const memos = slots.filter((value): value is Memo<any> => value instanceof Memo);
				const effects = slots.filter((value): value is Effect => value instanceof Effect);

				hasPendingWork = false;

				for (const memo of memos) {
					try {
						if (!memo.isStale)
							continue;

						memo.flush();
						hasPendingWork = true;
					} catch (error) {
						errors.push(toError(error));
					}
				}

				for (const effect of effects) {
					if (!effect.isPending)
						continue;

					const result = effect.execute();

					if (result.error)
						errors.push(result.error);
					else
						hasPendingWork = true;
				}
			} while (hasPendingWork && this.#hasPendingComputations());
		} finally {
			this.#isFlushing = false;
		}

		if (errors.length === 1)
			throw errors[0];

		if (errors.length > 1)
			throw new AggregateError(errors, "Multiple reactive computations failed.");
	}

	readonly #hasPendingComputations = (): boolean => {
		return Object.values(this.#slots).some(({ data }) =>
			(data instanceof Memo && data.isStale) ||
			(data instanceof Effect && data.isPending)
		);
	};


	public run(): Result<T> {
		if (this.#isRunning)
			return { error: new Error("Cannot run a scope while it is already running.") };

		if (this.#isInitialized && !this.#isInvalidated)
			return { data: this.#result };

		this.#isRunning = true;
		this.#isInvalidated = false;
		this.#wasInvalidatedWhileRunning = false;

		const previousDependencies = new Set(this.#dependencies);
		const nextDependencies = new Set<ReactiveSource>();

		this.#nextDependencies = nextDependencies;

		try {
			const result = withActiveScope(this, () => withObserver(this, this.#closure));

			for (const dependency of previousDependencies) {
				if (!nextDependencies.has(dependency))
					dependency.removeObserver(this);
			}

			this.#dependencies.clear();

			for (const dependency of nextDependencies)
				this.#dependencies.add(dependency);

			this.#result = result;
			this.#isInitialized = true;
			this.#isInvalidated = this.#wasInvalidatedWhileRunning;

			return { data: result };
		} catch (error) {
			for (const dependency of nextDependencies) {
				if (!previousDependencies.has(dependency))
					dependency.removeObserver(this);
			}

			this.#isInvalidated = true;
			return { error: toError(error) };
		} finally {
			this.#nextDependencies = null;
			this.#isRunning = false;
			this.#wasInvalidatedWhileRunning = false;
			this.#emitEvents();
		}
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

	public onEvent(handler: ScopeEventHandler): Unsubscriber {
		this.#eventHandlers.push(handler);

		return () => {
			const index = this.#eventHandlers.indexOf(handler);

			if (index === -1)
				return false;

			this.#eventHandlers.splice(index, 1);
			return true;
		};
	}

	readonly #emitEvents = (): void => {
		if (this.#isRunning || this.#isEmitting)
			return;

		this.#isEmitting = true;
		const errors: Error[] = [];

		try {
			while (this.#queuedEvents.length) {
				const event = this.#queuedEvents.shift()!;

				if (event.type === ScopeEvent.Invalidated)
					this.#hasQueuedInvalidation = false;
				else if (event.type === ScopeEvent.Pending)
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
			this.#isEmitting = false;
		}

		if (errors.length === 1)
			throw errors[0];

		if (errors.length > 1)
			throw new AggregateError(errors, "Multiple scope event handlers failed.");
	};
}

export type ScopeEventHandler = <T extends ScopeEventType>(event: ScopeEvent<T>) => any;

export type ScopeEvent<T extends ScopeEventType> = {
	readonly type: T;
	readonly data: ScopeEvents[T];
};

const Invalidated = "INVALIDATED" as const;
const Pending = "PENDING" as const;

export const ScopeEvent = { Invalidated, Pending } as const;

export type ScopeEventType = (typeof ScopeEvent)[keyof typeof ScopeEvent];

type ScopeEvents = {
	[Invalidated]: {};
	[Pending]: {};
};

export const scope = <T>(closure: ScopeClosure<T>): Scope<T> => new Scope<T>(closure);

export type Result<T> =
	| { readonly data: T; readonly error?: undefined }
	| { readonly data?: undefined; readonly error: Error };

const toError = (error: unknown): Error =>
	error instanceof Error ? error : new Error(String(error));
