import { Store } from "@ion/core";
import type { Model } from "./model.js";

export abstract class Table<T extends Model> extends Store<T> {
	public abstract query<Q extends Query<T>>(query: Q): QueryResult<T, Q>;
}

export type Query<T> = {
	where?: "*" | keyof T | (keyof T[]);
};

export type QueryResult<T, _Q> = T[];
