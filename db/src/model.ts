import { Entity, type ID } from "@ion/core";
import type { MaybePromise } from "@ion/utils";

export abstract class Model extends Entity {
	declare private static columns?: Record<string, ColumnMeta & ColumnTypeMeta<any, any>>;
	declare private static primaryKey?: string;

	public static readonly column = <T, K extends keyof T>(meta: ColumnTypeMeta<T, K> | undefined = undefined) => (Class: T, key: K) => {
		const ctor = (Class as any).constructor as typeof Model;
		const propType = Reflect.getMetadata("design:type", Class as any, key.toString());
		const typeName = this.getColumnTypeName(meta, propType);
		if (!ctor.columns)
			ctor.columns = {};
		const { type, ...rest } = (meta || {}) as any;
		ctor.columns[key.toString()] = {
			...rest,
			type: typeName as any,
		}
	};

	public static readonly primary = <T, K extends keyof T>(Class: T, key: K) => {
		const ctor = (Class as any).constructor as typeof Model;
		if (ctor.primaryKey) {
			throw new Error(`Duplicate primary key for ${ctor.name}.${ctor.primaryKey} and ${ctor.name}.${key.toString()}!`);
		}
		ctor.primaryKey = key.toString();
	}

	private static getColumnTypeName = <T, K extends keyof T>(meta: ColumnTypeMeta<T, K> | undefined, propType: any) => {
		if (!meta?.type) {
			switch (propType) {
				case String:
					return "text";
				case Number:
					return "int";
				case Boolean:
					return "boolean";
				default:
					throw new Error(`Type ${propType.name} not implemented as column type!`)
			}
		}
		if (length !== undefined)
			return `${meta.type}(${length})`;
		return meta.type;
	}

	//public static create<T extends typeof Model, P extends ModelProps<InstanceType<T>>>(this: T, props: P): P {
	//	return props;
	//} 
}

type IdKeys<T extends Model> = {
	[K in keyof T]: T[K] extends ID<any> ? K : never;
}[keyof T];

export type ModelProps<T extends Model> = Omit<T, IdKeys<T>>;

export const primary = Model.primary;

export const column = Model.column;

export type ModelType<T extends Model> = new (...args: any) => T;

type ColumnMeta = {
	readonly unique?: boolean;
	readonly nullable?: boolean;
};

type ColumnTransformers<T> = {
	readonly onInsert?: (value: T) => MaybePromise<T>,
	readonly onSelect?: (value: T) => MaybePromise<T>,
}

type ColumnTypeMeta<T, K extends keyof T> = ColumnMeta & ColumnTransformers<T[K]> & (
	T[K] extends string ? Partial<StringMeta | LengthStringMeta> :
	T[K] extends number ? Partial<NumberMeta> :
	never
);

type StringMeta = {
	readonly type: "text" | "bpchar";
	readonly length?: undefined;
};

type LengthStringMeta = {
	readonly type: "varchar" | "bpchar";
	readonly length: number;
};

type NumberMeta = {
	readonly type: "int" | "real";
};
