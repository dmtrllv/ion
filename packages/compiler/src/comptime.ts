import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { node_modules } from "./env.js";
import { Compiler } from "./compiler.js";
import assert from "node:assert";
import ts from "typescript";

export type ComptimeManifest = {
	exports?: Record<string, Record<string, ComptimeType>>;
};

export type ComptimeType =
	| "comptime"
	| "comptime.fn"
	| "comptime.fn.decl"
	| "comptime.macro";

export type ComptimeItem = {
	readonly name: string;
	readonly type: ComptimeType;
	readonly symbol: ts.Symbol;
	readonly comptimeModulePath: string;
	readonly isExternal: boolean;
	result?: any;
};

export type ComptimeBinding = {
	readonly name: string;
	readonly type: "comptime";
	readonly symbol: ts.Symbol;
	readonly comptimeModulePath: string;
	readonly isExternal: boolean;
	readonly result?: any;
};

export const resolveComptimeSymbols = (compiler: Compiler): ComptimeSymbols => {
	const comptimePackagePath = realpathSync(resolve(node_modules, "@ion/comptime/src/index.ts"));
	const source = compiler.program.getSourceFile(comptimePackagePath);
	assert.ok(source, "Could not load @ion/comptime source at " + comptimePackagePath);
	const moduleSymbol = compiler.typeChecker.getSymbolAtLocation(source);
	assert.ok(source, "Could not get module Symbol for " + comptimePackagePath);

	const comptimeSymbol = compiler.typeChecker.getExportsOfModule(moduleSymbol!).find(symbol => symbol.getName() === "comptime");
	assert.ok(comptimeSymbol, `Could not find exported comptime symbol from @ion/comptime!`);

	let macroSymbol: ts.Symbol | undefined = undefined;
	let constFnSymbol: ts.Symbol | undefined = undefined;

	for (const statement of source.statements) {
		if (ts.isVariableStatement(statement)) {
			const decl = statement.declarationList.declarations[0];
			if (!decl)
				continue;
			if (ts.isIdentifier(decl.name)) {
				switch (decl.name.text) {
					case "macro":
						macroSymbol = compiler.typeChecker.getSymbolAtLocation(decl.name);
						break;
					case "constfn":
						constFnSymbol = compiler.typeChecker.getSymbolAtLocation(decl.name);
						break;
				}
			}
		}
	}
	assert.ok(macroSymbol, `Could not find macro symbol from @ion/comptime!`);
	assert.ok(constFnSymbol, `Could not find constfn symbol from @ion/comptime!`);

	return {
		comptime: comptimeSymbol,
		fn: constFnSymbol!,
		macro: macroSymbol!,
	}
}

export type ComptimeSymbols = {
	readonly comptime: ts.Symbol;
	readonly fn: ts.Symbol;
	readonly macro: ts.Symbol;
};