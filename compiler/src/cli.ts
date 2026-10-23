#!/usr/bin/env node

import { Compiler } from "./compiler.js";

const type = process.argv.includes("--lib") ? "lib" : "app";

using compiler = Compiler.load(process.cwd());

if (compiler) {
	try {
		compiler.compile({ type });
	} catch (error) {
		console.dir(error, { depth: null });
		throw error;
	}
}
