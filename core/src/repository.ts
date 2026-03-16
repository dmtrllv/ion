import type { Entity } from "./entity.js";
import type { ID } from "./id.js";

export abstract class Repository<T extends Entity> {
	public abstract get(id: ID<T>): Promise<T | null>;
	public abstract getAll(): Promise<T[]>;
	public abstract save(entity: T): Promise<void>;
	public abstract delete(id: ID<T>): Promise<void>;
	public abstract query<Q extends Query<T> | Query<T>[]>(query: Q): Promise<QueryResult<T, Q>>;
}

export type Query<T> = {
	[K in keyof T]?: T[K] | T[K][];
};

export type QueryResult<T extends Entity, Q extends Query<T> | Query<T>[]> = {} & Partial<T>[];

type RepoType<T> = T extends Repository<infer U> ? U : never;

type IsExact<A, B> =
	(<T>() => T extends A ? 1 : 2) extends
	(<T>() => T extends B ? 1 : 2)
	? true
	: false;

type IsRepository<T> = T extends Repository<infer U> ? IsExact<T, Repository<U>> : false;

type RepoArgs<T, K extends keyof T> = IsRepository<T[K]> extends true ? [new (...args: any[]) => RepoType<T[K]>] : [];

export const repo = <T, K extends keyof T>(..._args: RepoArgs<T, K>) => (_target: T, _key: K) => {

};