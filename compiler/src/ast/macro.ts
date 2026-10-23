import * as ts from "typescript/ast";
import { Ast, NodeMatcher } from "./ast.js";
import { EvaluationType, Expression } from "./expression.js";
import { Compiler } from "../compiler.js";
import { cached } from "../utils.js";
import assert from "node:assert";
import { Exportable } from "./statement.js";

const isMacroDeclaration: NodeMatcher = async (node, compiler) => (await parseComptimeDeclarationType(node, compiler)) === "macro";

// @internal
@Ast.register(isMacroDeclaration)
export class Macro extends Expression<ts.VariableStatement> implements Exportable {
	public override get evaluationType(): EvaluationType {
		return "comptime";
	}

	@cached
	public get name() {
		const name = this.node.declarationList.declarations[0]!.name;
		assert.ok(name && ts.isIdentifier(name));
		return name.text;
	}

	@cached
	public get isExported(): boolean {
		if (this.node.modifiers)
			return this.node.modifiers.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) === true;
		return false;
	}
}

const parseComptimeDeclarationType = async (node: ts.Node, compiler: Compiler): Promise<"macro" | "fn" | "comptime" | undefined> => {
	if (!ts.isVariableStatement(node))
		return undefined;

	if (node.declarationList.declarations.length !== 1)
		return undefined;

	const decl = node.declarationList.declarations[0]!;
	if (!decl.initializer)
		return undefined;

	const s = await compiler.getComptimeSymbols()
	if (!s)
		return undefined;

	if (ts.isCallExpression(decl.initializer)) {
		if (ts.isPropertyAccessExpression(decl.initializer.expression)) {
			const access = decl.initializer.expression;
			if (ts.isIdentifier(access.name)) {
				const symbol = await compiler.ast.resolveAliasedSymbol(access.name);
				if (symbol === s.fn)
					return "fn";
				else if (symbol === s.macro)
					return "macro";
			}
		} else if (ts.isIdentifier(decl.initializer.expression)) {
			const symbol = await compiler.ast.resolveAliasedSymbol(decl.initializer.expression);
			if (symbol === s.comptime)
				return "comptime";
		}
	}

	return undefined;
}
