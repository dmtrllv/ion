
import { Comptime, comptime } from "@ion/comptime";
import { ReactiveObserver, ReactiveResult, ReactiveSource, trackDependency, withObserver } from "./reactive.js";
import { getActiveScope } from "./scope.js";

export class Memo<T> implements ReactiveSource, ReactiveObserver {
	readonly #closure: () => T;
	readonly #observers = new Set<ReactiveObserver>();
	readonly #dependencies = new Set<ReactiveSource>();
	readonly #scope = getActiveScope();

	#nextDependencies: Set<ReactiveSource> | null = null;
	#value!: T;
	#isInitialized = false;
	#isStale = true;
	#isComputing = false;
	#isDisposed = false;

	public constructor(closure: () => T) {
		this.#closure = closure;
		this.recompute();
	}

	public get isStale(): boolean {
		return this.#isStale;
	}

	public get isDisposed(): boolean {
		return this.#isDisposed;
	}

	public readonly get = (): T => {
		if (this.#isDisposed)
			throw new Error("Cannot read a disposed memo.");

		trackDependency(this);
		return this.#value;
	};

	public readonly inspect = (): T => {
		if (this.#isDisposed)
			throw new Error("Cannot inspect a disposed memo.");

		return this.#value;
	};

	// @internal
	public track(source: ReactiveSource): void {
		if (this.#isDisposed || !this.#nextDependencies || this.#nextDependencies.has(source))
			return;

		this.#nextDependencies.add(source);
		source.addObserver(this);
	}

	// @internal
	public invalidate(): void {
		if (this.#isDisposed || this.#isStale)
			return;

		this.#isStale = true;
		this.#scope.notifyPending();
	}

	// @internal
	public flush(): void {
		if (this.#isDisposed)
			throw new Error("Cannot flush a disposed memo.");

		if (!this.#isStale)
			return;

		if (this.#isComputing)
			throw new Error("Cannot recompute a memo while it is already computing.");

		for (const dependency of this.#dependencies) {
			if (dependency instanceof Memo)
				dependency.flush();
		}

		this.recompute();
	}

	public addObserver(observer: ReactiveObserver): void {
		if (this.#isDisposed)
			throw new Error("Cannot subscribe to a disposed memo.");

		this.#observers.add(observer);
	}

	public removeObserver(observer: ReactiveObserver): void {
		this.#observers.delete(observer);
	}

	public readonly dispose = (): ReactiveResult<{}> => {
		if (this.#isDisposed)
			return { data: {} };

		if (this.#isComputing)
			return { error: new Error("Cannot dispose a memo while it is computing."), source: this };

		this.#isDisposed = true;
		this.#isStale = false;

		for (const dependency of this.#dependencies)
			dependency.removeObserver(this);

		this.#dependencies.clear();
		this.#observers.clear();

		return { data: {} };
	};

	private readonly recompute = (): void => {
		if (this.#isDisposed)
			throw new Error("Cannot recompute a disposed memo.");

		if (this.#isComputing)
			throw new Error("Cannot recompute a memo while it is already computing.");

		this.#isComputing = true;

		const previousDependencies = new Set(this.#dependencies);
		const nextDependencies = new Set<ReactiveSource>();
		const wasInitialized = this.#isInitialized;
		const previousValue = this.#value;

		this.#nextDependencies = nextDependencies;

		try {
			const value = withObserver(this, this.#closure);

			for (const dependency of previousDependencies) {
				if (!nextDependencies.has(dependency))
					dependency.removeObserver(this);
			}

			this.#dependencies.clear();

			for (const dependency of nextDependencies)
				this.#dependencies.add(dependency);

			this.#value = value;
			this.#isInitialized = true;
			this.#isStale = false;

			if (wasInitialized && !Object.is(previousValue, value)) {
				for (const observer of [...this.#observers])
					observer.invalidate();
			}
		} catch (error) {
			for (const dependency of nextDependencies) {
				if (!previousDependencies.has(dependency))
					dependency.removeObserver(this);
			}

			this.#isStale = true;
			throw error;
		} finally {
			this.#nextDependencies = null;
			this.#isComputing = false;
		}
	};
}

export const createMemo = <T>(id: string, closure: () => T): Memo<T> => {
	return getActiveScope().getOrInsertSlot(id, () => new Memo(closure));
};

export const memo = comptime(() => {
	let count = 0;

	return comptime.macro(<T>(ctx: Comptime.Context, value: Comptime.Expr<() => T>) => {
		const id = ctx.syntax.literal("memo_" + count++);
		return ctx.syntax.call<Memo<T>, [string, () => T]>(createMemo, id, value);
	});
});
