export type ScopeClosure<T> = () => T;

export class Scope<T> {
	static #activeScope: Scope<any> | null = null

	readonly #closure: ScopeClosure<T>;
	
	public constructor(closure: ScopeClosure<T>) {
		this.#closure = closure;
	}

	public run(): T {
		const prev = Scope.#activeScope;
		Scope.#activeScope = this;
		const result = this.#closure();
		Scope.#activeScope = prev;
		return result;
	}
}

export const scope = <T>(closure: ScopeClosure<T>): Scope<T> => new Scope(closure);