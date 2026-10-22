import assert from "node:assert"
import { readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

export const loadPackageJson = (path: string) => {
	assert.ok(isAbsolute(path), `provided package.json path ${path} must be absolute`);
	const json = JSON.parse(readFileSync(join(path, "package.json"), "utf-8"));
	assert.ok(typeof json === "object", `package.json is not ab object at ${path}`);
	assert.ok(typeof json.name === "string", `missing name field in package.json is at ${path}`);
	assert.ok(typeof json.version === "string", `missing version field in package.json at ${path}`);

	return {
		exports: {},
		dependencies: {},
		ion: {},
		...json,
	}
};

export type PackageJson = {
	readonly name: string;
	readonly version: string;
	readonly ion: IonConfig;
};

export type IonConfig = {
	comptime?: {
		output?: string;
	};
}
