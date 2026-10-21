#!/usr/bin/env node
import { Compiler } from "@ion/compiler";

if(!process.execArgv.includes("--experimental-vm-modules")) {
	const { spawnSync } = await import("node:child_process");

	const result = spawnSync(process.execPath, ["--experimental-vm-modules", ...process.execArgv, ...process.argv.slice(1)], {
		stdio: "inherit"
	});

	process.exit(result.status ?? 1);
}

console.clear();
process.stdout.write('\x1B[2J\x1B[3J\x1B[H');

const compiler = new Compiler(process.cwd());

if (process.argv.includes("build")) {
	compiler.compile();
} else if (process.argv.includes("watch")) {

} else if (process.argv.includes("run")) {

}



