export const cached = (_target: Object, _key: string, descriptor: PropertyDescriptor) => {
	const getter = descriptor.get!;

	const cache = new WeakMap<object, unknown>();

	descriptor.get = function () {
		if (!cache.has(this))
			cache.set(this, getter.call(this));
		return cache.get(this);
	};

	return descriptor;
}

export const mapObj = <T extends {}, U>(obj: T | null | undefined, map: (val: T[keyof T], key: keyof T, obj: T) => U): Record<keyof T, U> => {
	const newRecord = {} as Record<keyof T, U>;
	obj = obj || {} as T;
	for (const k in obj)
		newRecord[k] = map(obj[k], k, obj);
	return newRecord;
}