
import { Effect } from "./effect.js";
import { Memo } from "./memo.js";
import { ReactiveObserver, ReactiveSource, Unsubscriber, withObserver } from "./reactive.js";
import { Slot, SlotData } from "./slot.js";

export interface GlobalScope {
	flush(): void;
	onEvent(handler: ScopeEventHandler): Unsubscriber;
	dispose(): void;
}

export class Scope<T> implements ReactiveObserver {
	static readonly #globalScope = new Scope(() => { }, null);

	public static get global(): GlobalScope {
		return this.#globalScope;
	}

	readonly #closure: ScopeClosure<T>;
	readonly #eventHandlers: ScopeEventHandler[] = [];
	readonly #slots: Record<string, Slot> = {};
	readonly #dependencies = new Set<ReactiveSource>();
	readonly #children = new Set<Scope<any>>();

	#parent: Scope<any> | null;
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
	#isDisposed = false;

	public get isInitialized(): boolean {
		return this.#isInitialized;
	}

	public get isInvalidated(): boolean {
		return this.#isInvalidated;
	}

	public get isDisposed(): boolean {
		return this.#isDisposed;
	}

	public constructor(closure: ScopeClosure<T>, parent: Scope<any> | null = activeScope) {
		this.#closure = closure;

		if (parent && parent.isDisposed)
			throw new Error("Cannot create a child scope in a disposed scope.");

		this.#parent = parent;

		if (parent) {
			parent.addChild(this);
		}
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
			this.#queuedEvents.push({ type: ScopeEvent.Invalidated, data: {}, sender: this });
		}

		this.#emitEvents();
	}

	// @internal
	public notifyPending(): void {
		if (this.#isDisposed || this.#hasQueuedPending)
			return;

		this.#hasQueuedPending = true;
		this.#queuedEvents.push({ type: ScopeEvent.Pending, data: {}, sender: this });

		this.#emitEvents();
	}

	// @internal
	public track(source: ReactiveSource): void {
		if (this.#isDisposed)
			return;

		if (!this.#nextDependencies || this.#nextDependencies.has(source))
			return;

		this.#nextDependencies.add(source);
		source.addObserver(this);
	}

	public flush(): void {
		if (this.#isDisposed)
			throw new Error("Cannot flush a disposed scope.");

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
		if (this.#isDisposed)
			return { error: new Error("Cannot run a disposed scope.") };

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
			const wasInvalidatedWhileRunning = this.#wasInvalidatedWhileRunning;

			this.#nextDependencies = null;
			this.#isRunning = false;
			this.#wasInvalidatedWhileRunning = false;

			if (wasInvalidatedWhileRunning && !this.#hasQueuedInvalidation) {
				this.#hasQueuedInvalidation = true;
				this.#queuedEvents.push({ type: ScopeEvent.Invalidated, data: {}, sender: this });
			}

			this.#emitEvents();
		}
	}

	// @internal
	public getOrInsertSlot<T extends SlotData>(id: string, onInsert: () => T): T {
		let slot = this.#slots[id];

		if (!slot) {
			const data = onInsert();
			slot = new Slot(data);
			this.#slots[id] = slot;

			if (data instanceof Effect)
				this.notifyPending();
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

	// @internal
	public receiveEvent(event: ScopeEvent<ScopeEventType>): void {
		const errors: Error[] = [];

		for (const handler of [...this.#eventHandlers]) {
			try {
				handler(event);
			} catch (error) {
				errors.push(toError(error));
			}
		}

		if (this.#parent) {
			try {
				this.#parent.receiveEvent(event);
			} catch (error) {
				errors.push(toError(error));
			}
		}

		if (errors.length === 1)
			throw errors[0];

		if (errors.length > 1)
			throw new AggregateError(errors, "Multiple scope event handlers failed.");
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

				try {
					this.receiveEvent(event);
				} catch (error) {
					errors.push(toError(error));
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

	public detach() {
		if (this.#parent) {
			this.#parent.removeChild(this);
			this.#parent = null;
		}
	}

	public dispose(): void {
		if (this.#isDisposed)
			return;

		if (this.#isRunning || this.#isFlushing)
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

		this.detach();

		for (const dependency of this.#dependencies)
			dependency.removeObserver(this);

		this.#dependencies.clear();

		for (const slot of Object.values(this.#slots)) {
			const value = slot.data;

			if (!(value instanceof Effect) && !(value instanceof Memo))
				continue;

			try {
				const result = value.dispose();

				if (result.error)
					errors.push(result.error);
			} catch (error) {
				errors.push(toError(error));
			}
		}

		for (const id of Object.keys(this.#slots))
			delete this.#slots[id];

		this.#queuedEvents = [];
		this.#hasQueuedInvalidation = false;
		this.#hasQueuedPending = false;
		this.#eventHandlers.length = 0;

		if (errors.length === 1)
			throw errors[0];

		if (errors.length > 1)
			throw new AggregateError(errors, "Multiple reactive computations failed during scope disposal.");
	}
}


export type ScopeClosure<T> = () => T;

let activeScope: Scope<any> = Scope.global as Scope<any>;

// @internal
export const getActiveScope = (): Scope<any> => activeScope;

// @internal
export const withActiveScope = <T>(scope: Scope<any>, closure: () => T): T => {
	const previous = activeScope;
	activeScope = scope;

	try {
		return closure();
	} finally {
		activeScope = previous;
	}
};


export type ScopeEventHandler = <T extends ScopeEventType>(event: ScopeEvent<T>) => any;

export type ScopeEvent<T extends ScopeEventType> = {
	readonly type: T;
	readonly data: ScopeEvents[T];
	readonly sender: Scope<any>;
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

const toError = (error: unknown): Error => error instanceof Error ? error : new Error(String(error));
