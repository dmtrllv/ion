import * as ts from "typescript/async";
import * as ast from "typescript/ast";
import { Compiler } from "../compiler.js";
import { resolve } from "path";
import assert from "assert";
import { realpathSync } from "fs";

export type ComptimeSymbols = {
	readonly comptime: ts.Symbol;
	readonly macro: ts.Symbol;
	readonly fn: ts.Symbol;
}

export const resolveComptimeSymbols = async (compiler: Compiler): Promise<ComptimeSymbols | undefined> => {
	let comptimePackagePath = resolve(compiler.nodeModulesPath, "@ion/comptime/src/index.ts");
	let source = await compiler.program.getSourceFile(comptimePackagePath);
	if(!source) {
		comptimePackagePath = realpathSync(comptimePackagePath);
		source = await compiler.program.getSourceFile(comptimePackagePath);
	}
	if(!source)
		return undefined;

	const moduleSymbol = await compiler.checker.getSymbolAtLocation(source);
	assert.ok(source, "Could not get module Symbol for " + comptimePackagePath);

	const comptimeSymbol = (await compiler.checker.getExportsOfModule(moduleSymbol!)).find(symbol => symbol.name === "comptime");
	assert.ok(comptimeSymbol, `Could not find exported comptime symbol from @ion/comptime!`);

	let macroSymbol: ts.Symbol | undefined = undefined;
	let constFnSymbol: ts.Symbol | undefined = undefined;

	for (const statement of source.statements) {
		if (ast.isVariableStatement(statement)) {
			const decl = statement.declarationList.declarations[0];
			if (!decl)
				continue;
			if (ast.isIdentifier(decl.name)) {
				switch (decl.name.text) {
					case "macro":
						macroSymbol = await compiler.checker.getSymbolAtLocation(decl.name);
						break;
					case "constfn":
						constFnSymbol = await compiler.checker.getSymbolAtLocation(decl.name);
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
