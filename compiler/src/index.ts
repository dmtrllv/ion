#!/usr/bin/env node

import { argv, cwd } from "node:process";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { Compiler } from "./compiler.js";
import { ModuleResolver } from "./passes/resolver.js";
import { ModuleTransformer } from "./passes/transformer.js";
import { ComptimeEvaluator } from "./passes/evaluator.js";
import { ComptimeWriter } from "./passes/writer.js";
import { ComptimeManifestWriter } from "./passes/manifest.js";

const root = cwd();
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf-8"));

const comptimeOutput = resolve(
	root,
	pkg?.ion?.comptime?.output ?? "./comptime",
);

const isLibBuild = argv.includes("--lib");

mkdirSync(comptimeOutput, { recursive: true });

Compiler.run(root, async (compiler) => {
	const modules = await compiler.run(ModuleResolver);
	const transformedModules = await compiler.run(ModuleTransformer, modules, comptimeOutput,);
	const comptimeEvaluations = await compiler.run(ComptimeEvaluator, modules, transformedModules);
	await compiler.run(ComptimeWriter, comptimeEvaluations, modules);
	if (isLibBuild)
		await compiler.run(ComptimeManifestWriter, modules, transformedModules, pkg);
});