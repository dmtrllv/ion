
import { Comptime, comptime } from "@ion/comptime";
import { getActiveScope } from "./scope.js";
import { ReactiveObserver, ReactiveResult, ReactiveSource, withObserver } from "./reactive.js";

export type EffectCleanupCallback = () => void;

export type EffectClosure = () => void | EffectCleanupCallback;

export class Effect implements ReactiveObserver {
	readonly #closure: EffectClosure;
	readonly #scope = getActiveScope();
	readonly #dependencies = new Set<ReactiveSource>();
	readonly #observers = new Set<ReactiveObserver>();
	#nextDependencies: Set<ReactiveSource> | null = null;
	#cleanup: EffectCleanupCallback | undefined;
	#isPending = true;
	#isRunning = false;
	#isDisposed = false;
	#wasInvalidatedWhileRunning = false;

	public constructor(closure: EffectClosure) {
		this.#closure = closure;
		this.#scope.invalidate();
	}

	public get isPending(): boolean {
		return this.#isPending;
	}

	public get isDisposed(): boolean {
		return this.#isDisposed;
	}

	// @internal
	public track(source: ReactiveSource): void {
		if (this.#nextDependencies === null)
			return;

		this.#nextDependencies.add(source);
		source.addObserver(this);
	}

	// @internal
	public invalidate(): void {
		if (this.#isDisposed || this.#isPending)
			return;

		if (this.#isRunning) {
			this.#wasInvalidatedWhileRunning = true;
			return;
		}

		this.#isPending = true;
		this.#scope.invalidate();
	}

	// @internal
	public addObserver(observer: ReactiveObserver): void {
		this.#observers.add(observer);
	}

	// @internal
	public removeObserver(observer: ReactiveObserver): void {
		this.#observers.delete(observer);
	}

	// @internal
	public readonly execute = (): ReactiveResult<{}> => {
		if (this.#isDisposed)
			return { error: new Error("Cannot execute a disposed effect."), source: this };

		if (this.#isRunning)
			return { error: new Error("Cannot execute an effect while it is already running."), source: this };

		if (!this.#isPending)
			return { data: {} };

		this.#isRunning = true;
		this.#isPending = false;
		this.#wasInvalidatedWhileRunning = false;

		const previousDependencies = this.#dependencies;
		const nextDependencies = new Set<ReactiveSource>();

		try {
			const cleanup = this.#cleanup;
			this.#cleanup = undefined;

			cleanup?.();

			const result = withObserver(this, () => {
				this.#nextDependencies = nextDependencies;
				return this.#closure();
			});

			if (typeof result === "function") {
				this.#cleanup = result;
			}

			for (const source of previousDependencies) {
				if (!nextDependencies.has(source))
					source.removeObserver(this);
			}

			this.#dependencies.clear();

			for (const source of nextDependencies)
				this.#dependencies.add(source);

			if (this.#wasInvalidatedWhileRunning) {
				this.#isPending = true;
				this.#scope.invalidate();
			}

			return { data: {} };
		} catch (error) {
			for (const source of nextDependencies) {
				if (!previousDependencies.has(source))
					source.removeObserver(this);
			}

			this.#cleanup = undefined;
			this.#isPending = false;

			return {
				error: toError(error),
				source: this
			};
		} finally {
			this.#nextDependencies = null;
			this.#isRunning = false;
			this.#wasInvalidatedWhileRunning = false;
		}
	};

	public readonly dispose = (): ReactiveResult<{}> => {
		if (this.#isDisposed)
			return { data: {} };

		if (this.#isRunning)
			return { error: new Error("Cannot dispose an effect while it is running."), source: this };

		this.#isDisposed = true;
		this.#isPending = false;

		for (const source of this.#dependencies)
			source.removeObserver(this);

		this.#dependencies.clear();

		const cleanup = this.#cleanup;
		this.#cleanup = undefined;

		try {
			cleanup?.();
			return { data: {} };
		} catch (error) {
			return {
				error: toError(error),
				source: this
			};
		}
	};
}

const toError = (error: unknown): Error => {
	return error instanceof Error ? error : new Error(String(error));
};

export const createEffect = (id: string, closure: EffectClosure): Effect => {
	return getActiveScope().getOrInsertSlot(id, () => new Effect(closure));
};

export const effect = comptime((ctx) => {
	let count = 0;
	const fnRef = ctx.syntax.ref(createEffect);

	return comptime.fn((ctx: Comptime.Context, closure: Comptime.Expr<EffectClosure>) => {
		const id = ctx.syntax.literal("effect_" + (count++));
		return ctx.syntax.call<Effect, [string, EffectClosure]>(fnRef, id, closure);
	});
});
