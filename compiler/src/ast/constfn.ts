import * as ts from "typescript/ast";
import { Ast, NodeMatcher, EvaluationType } from "./ast.js";
import { Expression } from "./expression.js";
import { Compiler } from "../compiler.js";
import { cached } from "../utils.js";
import assert from "node:assert";
import { Exportable } from "./statement.js";
import { getCallIdentifier, parseComptimeDeclarationType } from "./utils.js";

const isConstFnDeclaration: NodeMatcher = (node, compiler) => (parseComptimeDeclarationType(node, compiler)) === "fn";

// @internal
@Ast.register(isConstFnDeclaration)
export class ConstFn extends Ast<ts.VariableStatement> implements Exportable {
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

const getConstFnCallDeclaration = (node: ts.Node, compiler: Compiler): ConstFn | undefined => {
	if (!ts.isCallExpression(node))
		return undefined;

	const callIdent = getCallIdentifier(node);
	if (!callIdent)
		return undefined;

	const symbol = compiler.ast.resolveAliasedSymbol(callIdent);
	if (symbol && symbol.valueDeclaration) {
		const x = symbol.valueDeclaration.resolve();
		assert.ok(x);
		const parent = compiler.ast.resolve(x.parent?.parent);
		if (parent.is(ConstFn)) {
			return parent
		}
	}

	return undefined;
}

@Ast.register((node, compiler) => !!getConstFnCallDeclaration(node, compiler))
export class ConstFnCall extends Expression<ts.CallExpression> {
	public override get evaluationType(): EvaluationType {
		return "comptime";
	}

	@cached
	public get declaration() {
		const decl = getConstFnCallDeclaration(this.node, this.compiler);
		assert.ok(decl);
		return decl;
	}
}
