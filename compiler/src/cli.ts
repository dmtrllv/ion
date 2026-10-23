#!/usr/bin/env node

import { Compiler } from "./compiler.js";

using compiler = Compiler.load(process.cwd());

if (compiler) {
	try {
		compiler.compile();
	} catch (error) {
		console.dir(error, { depth: null });
		throw error;
	}
}
