#!/usr/bin/env node

import { Compiler } from "./compiler.js";

await using compiler = await Compiler.load(process.cwd());

if (compiler) {
	await compiler.compile();
}
