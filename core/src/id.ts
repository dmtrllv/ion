const ID = Symbol("ID");

export type ID<T, Type = number> = {
	readonly [ID]?: new (...args: any) => T;
	readonly value: Type;
};

export const createId = <T, Type = number>(type: new (...args: any) => T, value: Type): ID<T, Type> => Object.seal(Object.freeze(({ [ID]: type, value })));