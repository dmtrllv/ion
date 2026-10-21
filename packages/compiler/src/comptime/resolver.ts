import ts from "typescript";
import { Compiler } from "../compiler.js";
import { ComptimeDeclaration, ComptimeExpression, ComptimeItem, ComptimeType } from "./item.js";
import assert from "node:assert";

let log = true;

export class ComptimeResolver {
	public readonly compiler: Compiler;

	readonly #seen = new WeakSet<ts.Expression | ts.Declaration>();
	readonly #expressions = new WeakMap<ts.Expression, ComptimeExpression>();
	readonly #declarations = new WeakMap<ts.Symbol, ComptimeDeclaration>();

	public constructor(compiler: Compiler) {
		this.compiler = compiler;
	}

	private readonly addDeclaration = (decl: ts.VariableDeclaration, type: ComptimeType): ComptimeDeclaration => {
		const declarationSymbol = this.compiler.typeChecker.getSymbolAtLocation(decl.name);
		assert.ok(declarationSymbol);
		const comptimeDecl = { symbol: declarationSymbol, type, declaration: decl };
		this.#declarations.set(declarationSymbol, comptimeDecl);
		return comptimeDecl;
	}

	private readonly addExpression = (expr: ts.Expression, type: ComptimeType, dependencies: ComptimeItem[] = []): ComptimeExpression => {
		const comptimeExpr = { expression: expr, type, dependencies };
		this.#expressions.set(expr, comptimeExpr);
		return comptimeExpr;
	}

	public readonly resolveVarDeclarations = (stmt: ts.VariableStatement): ComptimeDeclaration[] => {
		const comptimeDecls: ComptimeDeclaration[] = [];
		stmt.declarationList.declarations.forEach(decl => {
			const comptimeDecl = this.resolveVarDeclaration(decl);
			if (comptimeDecl)
				comptimeDecls.push(comptimeDecl);
		});
		return comptimeDecls;
	}

	public resolveVarDeclaration(decl: ts.VariableDeclaration): ComptimeDeclaration | undefined {
		if (!decl.initializer)
			return undefined;
		log = decl.getText().startsWith("ScopeEvent");
		const comptimeExpr = this.resolveExpr(decl.initializer);
		log = false;
		if (comptimeExpr) {
			switch (comptimeExpr.type) {
				case "fn.decl":
				case "macro.decl":
					return this.addDeclaration(decl, comptimeExpr.type);
				default:
					return this.addDeclaration(decl, "value");
			}
		}

		return undefined;
	}

	public resolveDeclaration(symbol: ts.Symbol): ComptimeDeclaration | undefined {
		if (this.#declarations.has(symbol))
			return this.#declarations.get(symbol);

		if ((symbol.flags & ts.SymbolFlags.Alias) !== 0)
			return this.resolveDeclaration(this.compiler.typeChecker.getAliasedSymbol(symbol));

		const decl = symbol.valueDeclaration;
		if (!decl || this.#seen.has(decl))
			return undefined;

		if (ts.isVariableDeclaration(decl))
			return this.resolveVarDeclaration(decl);

		return undefined;
	}

	public resolveExpr(expr: ts.Expression): ComptimeExpression | undefined {
		if (this.#expressions.has(expr))
			return this.#expressions.get(expr);

		if (this.#seen.has(expr)) {
			if (log) console.log("seen!");
			return undefined;
		}

		let type = this.resolveComptimeDeclType(expr);
		if (log) console.log("comptime decl type!", type);

		if (type)
			return this.addExpression(expr, type);

		if (ts.isAwaitExpression(expr))
			return this.resolveExpr(expr.expression);
		//console.log("resolve expr", expr.getText())
		// examine expression if eligable for comptime or not
		//console.log("skipping epxr", expr.getText())

		if (ts.isAsExpression(expr) || ts.isTypeAssertionExpression(expr) || ts.isSatisfiesExpression(expr)) {
			if (log) console.log("check as expr!");
			if (log) console.log("check as expr!", expr.expression.getText());
			const result = this.resolveExpr(expr.expression);
			if (log) console.log("as expr result:", result?.type);
			return result ? this.addExpression(expr, result.type, result.dependencies) : undefined;
		} else if (ts.isCallExpression(expr)) {
			if (log) console.log("iscall!");
			const comptimeCaller = this.resolveExpr(expr.expression);
			if (comptimeCaller) {
				switch (comptimeCaller.type) {
					case "fn.decl":
						return this.addExpression(expr, "fn.call", [comptimeCaller, /* comptime arguments */]);
					case "macro.decl":
						return this.addExpression(expr, "macro.call", [comptimeCaller, /* comptime arguments */]);
					default:
						console.log(`cannot call a ${comptimeCaller.type}!`)
						return undefined;
				}
			}
		} else if (ts.isIdentifier(expr)) {
			if (log) console.log("isIdentifier!");
			let symbol = this.compiler.typeChecker.getSymbolAtLocation(expr);
			assert.ok(symbol);
			const comptimeDecl = this.resolveDeclaration(this.compiler.getAliasedSymbol(symbol));
			if (comptimeDecl)
				return this.addExpression(expr, comptimeDecl.type);
		} else if (ts.isObjectLiteralExpression(expr)) {
			if (log) console.log("isObjectLiteralExpression!");
			let isComptime = true;
			for (const prop of expr.properties) {
				if (ts.isPropertyAssignment(prop)) {
					if (!this.resolveExpr(prop.initializer))
						isComptime = false;
				} else if (ts.isShorthandPropertyAssignment(prop)) {
					const symbol = this.compiler.typeChecker.getShorthandAssignmentValueSymbol(prop);
					assert.ok(symbol);

					const comptimeDecl = this.resolveDeclaration(symbol);
					if (!comptimeDecl)
						isComptime = false;
				} else if (ts.isMethodDeclaration(prop)) {
					// prop.body
					console.log("TODO: inspect method declaration");
				} else if (ts.isGetAccessorDeclaration(prop) || ts.isSetAccessorDeclaration(prop)) {
					// prop.body
					prop.body
					console.log("TODO: inspect getters and setters");
				}
			}
			if (isComptime)
				return this.addExpression(expr, "value");
		} else if (isPrimitive(expr)) {
			return this.addExpression(expr, "value");
		} else if (ts.isArrayLiteralExpression(expr)) {
			let isComptime = true;
			for (const item of expr.elements) {
				if (!this.resolveExpr(item))
					isComptime = false;
			}
			if (isComptime)
				return this.addExpression(expr, "value");
		} else {
			if (log) console.log(expr.kind);
		}

		return undefined;
	}

	private resolveComptimeDeclType = (expr: ts.Expression): ComptimeType | undefined => {
		if (ts.isAwaitExpression(expr))
			return this.resolveComptimeDeclType(expr.expression);

		if (ts.isCallExpression(expr)) {
			if (ts.isPropertyAccessExpression(expr.expression)) {
				const access = expr.expression;
				const symbol = this.compiler.typeChecker.getSymbolAtLocation(access.expression);
				assert.ok(symbol);
				return this.compiler.getComptimeType(symbol, access.name.text);
			} else if (ts.isIdentifier(expr.expression)) {
				const symbol = this.compiler.typeChecker.getSymbolAtLocation(expr.expression);
				assert.ok(symbol);

				const type = this.compiler.getComptimeType(symbol);
				if (type !== "decl")
					return type;

				// check if it returns a comptime macro or fn
				const closure = expr.arguments[0];
				if (!closure) {
					console.log(`Missing closure in comptime!`);
					return undefined;
				}

				if (ts.isArrowFunction(closure)) {
					return this.getComptimeReturnType(closure.body);
				} else if (ts.isFunctionDeclaration(closure) && closure.body) {
					return this.getComptimeReturnType(closure.body);
				}

				console.log("invalid comptime closure?");
				return undefined;
			}
		}
		return undefined;
	}

	private getComptimeReturnType(body: ts.ConciseBody): "macro.decl" | "fn.decl" | "value" | undefined {
		const [first, ...rest] = this.getReturnExpressions(body);
		if (!first)
			return undefined;

		const type = this.resolveComptimeDeclType(first);

		for (const r of rest) {
			const t = this.resolveComptimeDeclType(r);
			if (t !== type) {
				console.log(`comptime branched does not return the same kind of comptime type!`);
				return "value";
			}
		}

		if (!type)
			return "value";

		switch (type) {
			case "fn.decl":
			case "macro.decl":
				return type;
			default:
				return "value";
		}
	}

	private getReturnExpressions(body: ts.ConciseBody): ts.Expression[] {
		if (!ts.isBlock(body))
			return [body];

		const expressions: ts.Expression[] = [];

		const visit = (node: ts.Node) => {
			if (ts.isReturnStatement(node)) {
				if (node.expression)
					expressions.push(node.expression);
				return;
			}
			ts.forEachChild(node, visit);
		};

		visit(body);
		return expressions;
	}
}

const isPrimitive = (expr: ts.Expression): boolean => {
	return ts.isStringLiteral(expr)
		|| ts.isNumericLiteral(expr)
		|| ts.isBigIntLiteral(expr)
		|| expr.kind === ts.SyntaxKind.TrueKeyword
		|| expr.kind === ts.SyntaxKind.FalseKeyword
		|| expr.kind === ts.SyntaxKind.NullKeyword
		|| (ts.isIdentifier(expr) && expr.text === "undefined");
};