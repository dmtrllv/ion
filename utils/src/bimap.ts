export class BiMap<K, T> {
	private readonly keyValMap = new Map<K, T>();
	private readonly valKeyMap = new Map<T, K>();

	public has(key: K): boolean {
		return this.keyValMap.has(key);
	}

	public get(key: K): T | undefined {
		return this.keyValMap.get(key)
	}

	public set(key: K, value: T) {
		this.keyValMap.set(key, value);
		this.valKeyMap.set(value, key);
		return this;
	}

	public hasValue(value: T): boolean {
		return this.valKeyMap.has(value);
	}
	
	public getKey(value: T): K | undefined {
		return this.valKeyMap.get(value)
	}
}