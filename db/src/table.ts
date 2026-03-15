import { Store } from "@ion/core";

export abstract class Table<T> extends Store<T> {
	public abstract query<Q extends Query<T>>(query: Q): QueryResult<T, Q>;
}

export type Query<T> = {
	where?: "*" | keyof T | (keyof T[]);
};

export type QueryResult<T, _Q> = T[];
