import { createId, type ID } from "./id.js";
import type { Mapper } from "./mapper.js";
import type { Repository } from "./repository.js";
import type { Store } from "./store.js";

type EntityMeta = {
	store?: typeof Store<any>;
	mapper?: typeof Mapper<any, any>;
	repository?: typeof Repository<any>;
};

export abstract class Entity {
	private static readonly entities: Map<EntityType<any>, EntityMeta> = new Map();

	public static readonly register = (meta: EntityMeta = {}): ClassDecorator => (Class: any) => {
		this.entities.set(Class, meta);
	};

	public static readonly all = () => Array.from(this.entities.entries());

	public static createId<T extends Entity>(this: EntityType<T>, id: number): EntityID<T> {
		return createId(this, id);
	}

	//public readonly id: ID<T, number>;

	//public constructor(id: ID<T>) {
		//this.id = id;
	//}
}

export type EntityType<T extends Entity> = new (...args: any) => T;

export type EntityID<T extends Entity> = ID<T, number>;