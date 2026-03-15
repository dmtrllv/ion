import type { Constructor } from "@ion/utils";
import type { Model } from "./model.js";

export abstract class Database {
	declare private static models?: Set<typeof Model>;

	private static getModels<T extends typeof Database>(this: T): Set<typeof Model> {
		if (!("models" in this)) {
			this.models = new Set();
		}
		return this.models;
	}

	public static register<T extends Database>(this: Constructor<T>, _tableName?: string): ClassDecorator {
		const self = this as unknown as typeof Database;
		return (Class: unknown) => {
			self.getModels().add(Class as typeof Model);
		};
	}

	public constructor() { }
}
