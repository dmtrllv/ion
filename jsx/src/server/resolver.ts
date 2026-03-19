import { isClass, type Constructor } from "@ion/utils";
import { getClientMeta } from "./compiler.js";
import type { Dependency } from "./dependency.js";
import type { View, ViewType } from "../view.js";

export class DepResolver {
	public static resolve(Class: ViewType<View<any>>): Set<Dependency> {
		const resolver = new DepResolver();
		resolver.resolve(Class);
		return resolver.dependencies;
	}

	public readonly dependencies: Set<Dependency> = new Set();

	private constructor() { }

	private resolve(Class: Constructor<any>) {
		const meta = getClientMeta(Class);

		this.dependencies.add(Class);

		meta?.include.forEach(dep => {
			if (typeof dep === "function") {
				if (!isClass(dep)) { // set function
					this.dependencies.add(dep);
				} else {
					this.resolve(dep as Constructor<any>);
				}
			} else {
				console.log("Unknown dependency type!");
			}
		});
	}
}
