
import ts from "typescript";
import { resolve } from "node:path";
import assert from "node:assert";
import { realpathSync } from "node:fs";
import { node_modules } from "../paths.js";
import { Compiler } from "../compiler.js";

export const resolveComptimeSymbols = (compiler: Compiler): ComptimeSymbols | undefined => {
	let comptimePackagePath = resolve(node_modules, "@ion/comptime/src/index.ts");
	let source = compiler.program.getSourceFile(comptimePackagePath);
	if (!source) {
		comptimePackagePath = realpathSync(comptimePackagePath);
		source = compiler.program.getSourceFile(comptimePackagePath);
	}
	if (!source)
		return undefined;

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
		comptime: compiler.getAliasedSymbol(comptimeSymbol),
		fn: compiler.getAliasedSymbol(constFnSymbol),
		macro: compiler.getAliasedSymbol(macroSymbol),
	}
}

export type ComptimeSymbols = {
	readonly comptime: ts.Symbol;
	readonly fn: ts.Symbol;
	readonly macro: ts.Symbol;
};