import { isClass, type Constructor, type Fn } from "./type.js";

export class Enum<T extends Record<string, Constructor | Fn>> {
	private readonly _value: EnumTypeValue<T>;
	private readonly _type: string;

	public constructor(value: EnumTypeValue<T>, type: string) {
		this._type = type;
		this._value = value;
	}

	public match<R>(matcher: EnumMatcher<T, R>): R {
		const arm = matcher[this._type] || matcher._;
		return arm(this._value);
	}
}

export type EnumMatcher<T extends Record<string, Constructor | Fn>, U> = EnumMatcherObj<T, U> | (Partial<EnumMatcherObj<T, U>> & { _: (value: any) => U; });

type EnumMatcherObj<T extends Record<string, Constructor | Fn>, U> = {
	readonly [K in keyof T]:
	T[K] extends new (...args: any[]) => infer R ? (value: R) => U :
	T[K] extends (...args: any[]) => infer R ? (value: R) => U :
	never;
};

export type EnumType<T extends Record<string, Constructor | Fn>> = {
	readonly [K in keyof T]:
	T[K] extends new (...args: infer Args) => any ? (...args: Args) => Enum<T> :
	T[K] extends (...args: infer Args) => any ? (...args: Args) => Enum<T> :
	never;
};

type EnumTypeValue<T extends Record<string, Constructor | Fn>> = {
	readonly [K in keyof T]:
	T[K] extends new (...args: any[]) => infer R ? R :
	T[K] extends (...args: any[]) => infer R ? R :
	never;
}[keyof T];

export const createEnum = <T extends Record<string, Constructor | Fn>>(types: T): EnumType<T> => {
	const mapped: any = {};
	for (const k in types) {
		const type = types[k] as (Function | Constructor);
		mapped[k] = (...args: any[]) => new Enum<T>(isClass(type) ? new type(...args) : type(...args), k);
	}
	return mapped;
};

export const createEnumMatcher = <T extends Record<string, Constructor | Fn>, R>(_type: EnumType<T>, matcher: EnumMatcher<T, R>): EnumMatcher<T, R> => matcher;