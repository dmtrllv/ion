export type Reflect = {
	readonly type: <_T extends unknown>() => Reflect.TypeInfo
}


export const reflectContext: Reflect = {
	type: <_T extends any>(): Reflect.TypeInfo => {
		return {} as any;
	},
};

export namespace Reflect {


	export type TypeInfo =
		| Function
		| Class
		| Type
		| Namespace
		| Module
		| Enum;

	type TypeInfoKind<Kind extends string, T> = T & {
		readonly kind: Kind;
	}

	export type Function = TypeInfoKind<"function", {
		readonly name: string;
		readonly generics: string[]; // TODO:
		readonly arguments: FunctionArgument[];
		readonly returnType: TypeInfo;
	}>;

	export type FunctionArgument = {
		readonly name: string;
		readonly type: TypeInfo;
		readonly isOptional: boolean;
		readonly hasDefaultValue: boolean;
	};

	export type Class = TypeInfoKind<"class", {
		readonly name: string;
	}>;

	export type Type = TypeInfoKind<"type", {
		readonly name: string;
	}>;

	export type Namespace = TypeInfoKind<"namespace", {
		readonly name: string;
	}>;

	export type Interface = TypeInfoKind<"interface", {
		readonly name: string;
	}>;

	export type Module = TypeInfoKind<"module", {
		readonly name: string;
	}>;

	export type Enum = TypeInfoKind<"enum", {
		readonly name: string;
	}>;

	export type TypeKind =
		| "function"
		| "class"
		| "type"
		| "namespace"
		| "interface"
		| "module"
		| "enum";
}