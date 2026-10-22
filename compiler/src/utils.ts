import { existsSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, join } from "node:path";

export function cached<T extends WeakKey, Args extends unknown[], R>(target: any, ..._args: any): any {
	const cache: { value?: R } = {};

	return function (this: T, ...args: Args): R {
		if ("value" in cache)
			return cache.value;

		const result = target.call(this, ...args);
		cache.value = result;
		return result;
	};
};

export const resolveNodeModules = (from: string) => {
	let current = from;
	while (true) {
		const candidate = join(current, "node_modules");
		if (existsSync(candidate))
			return candidate;
		const parent = dirname(current);
		if (parent === current)
			return undefined;
		current = parent;
	}
}

export const isNodeBuiltinModule = (name: string): boolean => builtinModules.includes(name.replace(/^node:/, ""));