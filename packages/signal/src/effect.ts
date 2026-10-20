
import { type Comptime, comptime } from "@ion/comptime";
import { getActiveScope, withActiveScope } from "./scope.js";
import { type ReactiveObserver, type ReactiveResult, type ReactiveSource, withObserver } from "./reactive.js";

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
	}

	public get isPending(): boolean {
		return this.#isPending;
	}

	public get isDisposed(): boolean {
		return this.#isDisposed;
	}

	// @internal
	public track(source: ReactiveSource): void {
		if (!this.#nextDependencies || this.#nextDependencies.has(source))
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
		this.#scope.notifyPending();
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

		const previousDependencies = new Set(this.#dependencies);
		const nextDependencies = new Set<ReactiveSource>();
		this.#nextDependencies = nextDependencies;

		try {
			const cleanup = this.#cleanup;
			this.#cleanup = undefined;
			cleanup?.();

			const result: unknown = withActiveScope(this.#scope, () => withObserver(this, this.#closure));

			if (isThenable(result)) {
				void Promise.resolve(result).catch(() => { });
				throw new Error("Effect closures must be synchronous.");
			}

			if (typeof result === "function")
				this.#cleanup = result as EffectCleanupCallback;

			for (const dependency of previousDependencies) {
				if (!nextDependencies.has(dependency))
					dependency.removeObserver(this);
			}

			this.#dependencies.clear();

			for (const dependency of nextDependencies)
				this.#dependencies.add(dependency);

			if (this.#wasInvalidatedWhileRunning) {
				this.#isPending = true;
				this.#scope.notifyPending();
			}

			return { data: {} };
		} catch (error) {
			for (const dependency of previousDependencies) {
				if (!nextDependencies.has(dependency))
					dependency.removeObserver(this);
			}

			this.#dependencies.clear();

			for (const dependency of nextDependencies)
				this.#dependencies.add(dependency);

			this.#cleanup = undefined;
			this.#isPending = false;

			return { error: toError(error), source: this };
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

		for (const dependency of this.#dependencies)
			dependency.removeObserver(this);

		this.#dependencies.clear();
		this.#observers.clear();

		const cleanup = this.#cleanup;
		this.#cleanup = undefined;

		try {
			cleanup?.();
			return { data: {} };
		} catch (error) {
			return { error: toError(error), source: this };
		}
	};
}

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
	value !== null &&
	(typeof value === "object" || typeof value === "function") &&
	typeof (value as { then?: unknown }).then === "function";

const toError = (error: unknown): Error =>
	error instanceof Error ? error : new Error(String(error));

export const createEffect = (id: string, closure: EffectClosure): Effect => {
	return getActiveScope().getOrInsertSlot(id, () => new Effect(closure));
};

export const effect = comptime(() => {
	let count = 0;

	return comptime.macro((ctx: Comptime.Context, closure: Comptime.Expr<EffectClosure>) => {
		const id = ctx.syntax.literal("effect_" + count++);
		return ctx.syntax.call<Effect, [string, EffectClosure]>(createEffect, id, closure);
	});
});
