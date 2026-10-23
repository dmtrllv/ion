export const disposable = <T extends {}>(obj: T): AsyncDisposable<T> => {
	let isDisposed = false;

	const disposer = () => {
		isDisposed = true;
		Object.values(obj).map((val: any) => {
			if (val && typeof val === "object" && Symbol.dispose in val)
				return val[Symbol.dispose]()
		});
	};

	return new Proxy(obj, {
		get(target, p) {
			if (isDisposed)
				throw new Error(`disposable ${obj.constructor.name} is already disposed!`);

			if (p === Symbol.dispose)
				return disposer;

			return target[p as keyof typeof target];
		},
	}) as AsyncDisposable<T>;
};

export type AsyncDisposable<T> = T & {
	[Symbol.dispose]: () => Promise<void>;
};