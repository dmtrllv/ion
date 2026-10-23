import * as ts from "typescript/sync";
//import * as ast from "typescript/ast";
import { Compiler } from "../compiler.js";
import { resolve } from "path";
import assert from "assert";
import { realpathSync } from "fs";

export type ComptimeSymbols = {
	readonly comptime: ts.Symbol;
	readonly macro: ts.Symbol;
	readonly fn: ts.Symbol;
}

export const resolveComptimeSymbols = (compiler: Compiler): ComptimeSymbols | undefined => {
	let comptimePackagePath = resolve(compiler.nodeModulesPath, "@ion/compiler/types/comptime/api.d.ts");
	let source = compiler.program.getSourceFile(comptimePackagePath);
	if (!source) {
		comptimePackagePath = realpathSync(comptimePackagePath);
		source = compiler.program.getSourceFile(comptimePackagePath);
	}
	if (!source)
		return undefined;

	const moduleSymbol = compiler.checker.getSymbolAtLocation(source);
	assert.ok(source, "Could not get module Symbol for " + comptimePackagePath);

	const comptimeSymbol = (compiler.checker.getExportsOfModule(moduleSymbol!)).find(symbol => symbol.name === "comptime");
	assert.ok(comptimeSymbol, `Could not find exported comptime symbol from @ion/compiler!`);

	//let macroSymbol: ts.Symbol | undefined = undefined;
	//let constFnSymbol: ts.Symbol | undefined = undefined;

	//for (const statement of source.statements) {
	//	if (ast.isVariableStatement(statement)) {
	//		const decl = statement.declarationList.declarations[0];
	//		if (!decl)
	//			continue;
	//		if (ast.isIdentifier(decl.name)) {
	//			switch (decl.name.text) {
	//				case "macro":
	//					macroSymbol = compiler.ast.resolveAliasedSymbol(decl.name);
	//					break;
	//				case "constfn":
	//					constFnSymbol = compiler.ast.resolveAliasedSymbol(decl.name);
	//					break;
	//			}
	//		}
	//	}
	//}

	//assert.ok(macroSymbol, `Could not find macro symbol from @ion/comptime!`);
	//assert.ok(constFnSymbol, `Could not find constfn symbol from @ion/comptime!`);

	//return {
	//	comptime: comptimeSymbol,
	//	fn: constFnSymbol!,
	//	macro: macroSymbol!,
	//}

	const comptimeType = compiler.checker.getTypeOfSymbolAtLocation(comptimeSymbol, source);

	const macroSymbol = comptimeType.getProperty("macro");
	const constFnSymbol = comptimeType.getProperty("fn");

	assert.ok(macroSymbol, "Could not find comptime.macro property!");
	assert.ok(constFnSymbol, "Could not find comptime.fn property!");

	return {
		comptime: comptimeSymbol,
		fn: constFnSymbol,
		macro: macroSymbol,
	};
}
