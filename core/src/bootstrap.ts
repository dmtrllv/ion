import { Err, Ok, type Result } from "@ion/utils";
import fs from "node:fs";
import path from "node:path";

export class ModuleLoadError extends Error {
	public readonly path: string;
	
	public constructor(srcDir: string, fullPath: string, error: Error) {
		super(error.message);
		this.path = fullPath.replace(srcDir, "./src").replaceAll("\\", "/").replace(".js", ".ts");
	}
};

export const loadModules = async (srcDir: string, dir: string = srcDir): Promise<Result<void, ModuleLoadError[]>> => {
	const errors: ModuleLoadError[] = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			const result = await loadModules(srcDir, fullPath);
			if(result.isErr()) {
				errors.push(...result.error);
			}
		} else if (entry.name.endsWith(".js") || entry.name.endsWith(".jsx")) {
			try {
				await import("file://" + fullPath);
			} catch (e) {
				if (e instanceof Error) {
					errors.push(new ModuleLoadError(srcDir, fullPath, e));
				}
			}
		}
	}
	if(errors.length)
		return Err(errors);
	return Ok();
}