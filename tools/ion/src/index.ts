#!/usr/bin/env node
import { Compiler, Package } from "@ion/compiler";

const root = Package.get(process.cwd());

const compiler = new Compiler(root);

if (process.argv.includes("build")) {
	compiler.compile();
} else if (process.argv.includes("watch")) {

} else if (process.argv.includes("run")) {

}



