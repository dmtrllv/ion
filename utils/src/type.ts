export const isClass = (v: any): v is Constructor => {
	if (typeof v !== "function") return false;
	return /^class\s/.test(Function.prototype.toString.call(v));
}

export type Constructor<T = any, Args extends any[] = any[]> = new (...args: Args) => T;
export type Fn<T = any, Args extends any[] = any[]> = (...args: Args) => T;
export type AsyncFn<T = any, Args extends any[] = any[]> = (...args: Args) => Promise<T>;
export type MaybePromise<T> = T | Promise<T>;

export type Mutable<T> = T extends {} ? {
	-readonly [K in keyof T]: T[K];
} : T;