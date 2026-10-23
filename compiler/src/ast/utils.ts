import * as ts from "typescript/ast";
import { SymbolFlags, Symbol } from "typescript/sync";
import { Compiler } from "../compiler.js";
import assert from "node:assert";

export const resolveDeclaration = (node: ts.Expression, compiler: Compiler, seen = new Set<Symbol>()): ts.VariableDeclaration | undefined => {
	if (!ts.isIdentifier(node)) {
		return undefined;
	}

	let symbol = compiler.checker.getSymbolAtLocation(node);

	if (!symbol) {
		return undefined;
	}

	if (symbol.flags & SymbolFlags.Alias)
		symbol = compiler.checker.getAliasedSymbol(symbol);

	assert.ok(symbol);

	if (seen.has(symbol)) {
		return undefined;
	}

	seen.add(symbol);

	const declaration = symbol.valueDeclaration?.resolve();
	if (!declaration || !ts.isVariableDeclaration(declaration) || !declaration.initializer)
		return undefined;

	if (ts.isIdentifier(declaration.initializer))
		return resolveDeclaration(declaration.initializer, compiler, seen);

	return declaration;
}

export const getCallIdentifier = (node: ts.CallExpression): ts.Identifier | undefined => {
	let expression = node.expression;

	while (ts.isPropertyAccessExpression(expression))
		expression = expression.name ? expression.name : expression.expression;

	return ts.isIdentifier(expression) ? expression : undefined;
}

export const parseComptimeDeclarationType = (node: ts.Node, compiler: Compiler): "macro" | "fn" | "comptime" | undefined => {
	if (!ts.isVariableStatement(node))
		return undefined;

	if (node.declarationList.declarations.length !== 1)
		return undefined;

	const decl = node.declarationList.declarations[0]!;
	if (!decl.initializer)
		return undefined;

	const s = compiler.getComptimeSymbols()
	if (!s)
		return undefined;

	if (ts.isCallExpression(decl.initializer)) {
		if (ts.isPropertyAccessExpression(decl.initializer.expression)) {
			const access = decl.initializer.expression;
			if (ts.isIdentifier(access.name)) {
				const symbol = compiler.ast.resolveAliasedSymbol(access.name);
				if (symbol === s.fn)
					return "fn";
				else if (symbol === s.macro)
					return "macro";
			}
		} else if (ts.isIdentifier(decl.initializer.expression)) {
			const symbol = compiler.ast.resolveAliasedSymbol(decl.initializer.expression);
			if (symbol === s.comptime)
				return "comptime";
		}
	}

	return undefined;
}
