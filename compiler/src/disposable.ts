export const asyncDisposable = <T extends {}>(obj: T): AsyncDisposable<T> => {
	let isDisposed = false;

	const disposer = async () => {
		isDisposed = true;
		return Promise.all(Object.values(obj).map((val: any) => {
			if(val && typeof val === "object" && Symbol.asyncDispose in val)
				return val[Symbol.asyncDispose]()
		}));
	};

	return new Proxy(obj, {
		get(target, p) {
			if (isDisposed)
				throw new Error(`disposable ${obj.constructor.name} is already disposed!`);

			if (p === Symbol.asyncDispose)
				return disposer;

			return target[p as keyof typeof target];
		},
	}) as AsyncDisposable<T>;
};

export type AsyncDisposable<T> = T & {
	[Symbol.asyncDispose]: () => Promise<void>;
};