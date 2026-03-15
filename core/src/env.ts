import fs, { existsSync } from "node:fs";
import path from "node:path";

export const loadEnv = <T extends Record<string, string | number | boolean>>(defaultValues: T): Readonly<T> => {
	const p = path.resolve(process.cwd(), ".env");
	if (!existsSync(p)) {
		return defaultValues;
	}

	const source = fs.readFileSync(path.resolve(process.cwd(), ".env"), "utf-8");
	const lines = source.split("\n").map(line => line.replaceAll("\r", "").trim());
	lines.forEach(line => {
		const [key, value] = line.split("=").map(s => s.trim());
		if (key && value && (key.toLowerCase() in defaultValues)) {
			const k = key.toLowerCase() as keyof typeof defaultValues;
			const type = defaultValues[k]!.constructor;
			defaultValues[k] = type(value);
		}
	});
	return defaultValues;
}