#!/usr/bin/env node
console.clear();
process.stdout.write('\x1B[2J\x1B[3J\x1B[H');

import { Compiler } from "@ion/compiler";

const compiler = new Compiler(process.cwd());

if (process.argv.includes("build")) {
	compiler.compile();
} else if (process.argv.includes("watch")) {

} else if (process.argv.includes("run")) {

}



