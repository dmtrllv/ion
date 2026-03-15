export const lazy = <T extends {}>(init: () => T): T => {
	let buffer: T | undefined = undefined;

	let get = (): T => {
		buffer = init();
		get = () => buffer!;
		return buffer;
	};

	return new Proxy({}, {
		get(_, p) {
			return get()[p as keyof T];
		},
	}) as T;
};