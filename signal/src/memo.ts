export class Memo<T> {
	#value: T;

	public constructor(value: T) {
		this.#value = value;
	}

	public readonly get = (): T => {
		//trackDependency(this);
		return this.#value;
	};

	public readonly inspect = (): T => {
		return this.#value;
	};
}

export const memo = <T>(closure: () => T): Memo<T> => {
	return new Memo(closure());
};