
import { Comptime, comptime } from "@ion/comptime";
import { ReactiveObserver, ReactiveSource, trackDependency, withObserver } from "./reactive.js";
import { getActiveScope } from "./scope.js";

export class Memo<T> implements ReactiveSource, ReactiveObserver {
	readonly #closure: () => T;
	readonly #observers = new Set<ReactiveObserver>();
	readonly #dependencies = new Set<ReactiveSource>();
	#nextDependencies: Set<ReactiveSource> | null = null;
	#value!: T;
	#isInitialized = false;
	#isStale = true;
	#isComputing = false;

	public constructor(closure: () => T) {
		this.#closure = closure;
	}

	public readonly get = (): T => {
		trackDependency(this);

		if (this.#isStale)
			this.recompute();

		return this.#value;
	};

	public readonly inspect = (): T => {
		return this.#value;
	};

	// @internal
	public track(source: ReactiveSource): void {
		if (this.#nextDependencies === null)
			return;

		this.#nextDependencies.add(source);
		source.addObserver(this);
	}

	// @internal
	public invalidate(): void {
		if (this.#isStale)
			return;

		this.#isStale = true;

		for (const observer of [...this.#observers])
			observer.invalidate();
	}

	public addObserver(observer: ReactiveObserver): void {
		this.#observers.add(observer);
	}

	public removeObserver(observer: ReactiveObserver): void {
		this.#observers.delete(observer);
	}

	private readonly recompute = (): void => {
		if (this.#isComputing)
			throw new Error("Cannot recompute a memo while it is already computing.");

		this.#isComputing = true;

		const previousDependencies = this.#dependencies;
		const nextDependencies = new Set<ReactiveSource>();
		const wasInitialized = this.#isInitialized;
		const previousValue = this.#value;

		this.#nextDependencies = nextDependencies;

		try {
			const value = withObserver(this, this.#closure);

			for (const source of previousDependencies) {
				if (!nextDependencies.has(source))
					source.removeObserver(this);
			}

			this.#dependencies.clear();

			for (const source of nextDependencies)
				this.#dependencies.add(source);

			this.#value = value;
			this.#isInitialized = true;
			this.#isStale = false;

			if (wasInitialized && !Object.is(previousValue, value)) {
				for (const observer of [...this.#observers])
					observer.invalidate();
			}
		} catch (error) {
			for (const source of nextDependencies) {
				if (!previousDependencies.has(source))
					source.removeObserver(this);
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

export const memo = comptime((ctx) => {
	let count = 0;

	const fnRef = ctx.syntax.ref(createMemo);

	return comptime.fn(<T>(ctx: Comptime.Context, value: Comptime.Expr<() => T>) => {
		const id = ctx.syntax.literal("memo_" + count++);
		return ctx.syntax.call<Memo<T>, [string, () => T]>(fnRef, id, value);
	});
});