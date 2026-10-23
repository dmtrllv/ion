import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Compiler } from "../compiler.js";
import assert from "node:assert";
import { Macro } from "../ast/macro.js";
import { VariableStatement } from "../ast/var.js";
import { isExportable } from "../ast/statement.js";
import { resolve, sep } from "node:path";
import { ConstFn } from "../ast/constfn.js";

export class ComptimeManifest {
	public static load = (path: string) => {
		assert.ok(existsSync(path));
		const json = JSON.parse(readFileSync(path, "utf-8"));
		return new ComptimeManifest(json);
	}

	public static create = (compiler: Compiler) => {
		const root = compiler.root;
		const exports: Record<string, CopmtimeModuleExports> = {};
		for (const path of root.sourceFilePaths) {
			const relativePath = path.replace(root.sourcePath + sep, "").replaceAll("\\", "/");
			const module = compiler.ast.resolveModule(path);
			const moduleExports: CopmtimeModuleExports = {};
			for (const e of module.exports) {
				if (isExportable(e) && e.isExported) {
					if (e.isOneOf(Macro, ConstFn)) {
						moduleExports[e.name] = "comptime";
					} else if (e.is(VariableStatement)) {
						for (const v of e.variables)
							moduleExports[v.name] = v.expression?.evaluationType || "runtime";
					} else {
						console.log("check exports", e.constructor.name);
					}
				}
			}
			exports[relativePath] = moduleExports;
		}
		writeFileSync(resolve(root.path, "comptime.manifest.json"), JSON.stringify(exports, null, 2));
	}

	public readonly exports: Readonly<Record<string, Readonly<CopmtimeModuleExports>>>;

	private constructor(exports: Record<string, CopmtimeModuleExports>) {
		this.exports = exports;
	}
}

export type CopmtimeModuleExports = {
	[ident: string]: string;
};