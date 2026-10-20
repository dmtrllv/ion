import { comptime } from "@ion/comptime";
import { readFileSync } from "node:fs";

export const loadConfig = comptime.fn((path: string): { name: string; version: string; } => {
	const json = JSON.parse(readFileSync(path, "utf-8"));
	if(typeof json !== "object") {
		throw new Error(`Invalid config at ${path}!`);
	}
	if(!json.name) {
		throw new Error(`Missing name field at ${path}!`);
	}
	if(!json.version) {
		throw new Error(`Missing version field at ${path}!`);
	}
	return json;
});