import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { cwd } from "node:process";

const resolveNodeModulesDir = () => {
	let path = cwd();

	while (!existsSync(join(path, "node_modules"))) {
		const parent = dirname(path);

		if (parent === path) {
			throw new Error("Could not find node_modules!");
		}

		path = parent;
	}

	return join(path, "node_modules");
};

export const node_modules = resolveNodeModulesDir();