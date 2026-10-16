#!/usr/bin/env node

import { cwd } from "node:process";
import { Compiler } from "./compiler.js";
import { ModuleResolver } from "./passes/resolver.js";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ModuleTransformer } from "./passes/transformer.js";
import { ComptimeEvaluator } from "./passes/evaluator.js";

const root = cwd();

const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf-8"));

const comptimeOutput = resolve(root, pkg?.ion?.comptime?.output ?? "./comptime");
mkdirSync(comptimeOutput, { recursive: true });

Compiler.run(root, async (compiler) => {
	const comptimeModules = await compiler.run(ModuleResolver);
	const transformedModules = await compiler.run(ModuleTransformer, comptimeModules, comptimeOutput);
	await compiler.run(ComptimeEvaluator, transformedModules)
});
