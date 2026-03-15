import type { Entity } from "./entity.js";
import type { ID } from "./id.js"

export abstract class Store<T> {
	public abstract create(entity: T): Promise<void>;
	public abstract get(id: ID<T>): Promise<T | null>;
	public abstract getAll(): Promise<T[]>;
	public abstract update(id: ID<T>, entity: Partial<T>): Promise<void>;
	public abstract delete(id: ID<T>): Promise<void>;
}

export function store<T extends typeof Entity>(_type: T): PropertyDecorator {
	return (_target, _key) => {

	};
}