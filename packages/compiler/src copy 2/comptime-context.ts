import { Comptime } from "@ion/comptime";
import * as ts from "typescript";

const createLiteralExpression = (value: string | number | boolean): ts.Expression => {
	if (typeof value === "string") {
		return ts.factory.createStringLiteral(value);
	}

	if (typeof value === "number") {
		return ts.factory.createNumericLiteral(value);
	}

	return value ? ts.factory.createTrue() : ts.factory.createFalse();
};

const toExpression = (value: unknown): ts.Expression => {
	if (value !== null && typeof value === "object" && "kind" in value) {
		const node = value as ts.Node;

		if (ts.isExpression(node)) {
			return node;
		}
	}

	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
		return createLiteralExpression(value);
	}

	throw new Error(
		"Unsupported call argument: expected a TypeScript expression or primitive literal",
	);
};

export const createContext = (callerNode?: ts.CallExpression): Comptime.Context => {
	console.log("create context", { callerNode: callerNode || "top-level-eval" });
	return ({
		reflect: {
			type() {
				throw new Error("TODO")
			}
		},
		syntax: {
			parseExpr: (source) => {
				const sourceFile = ts.createSourceFile("comptime.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
				const statement = sourceFile.statements[0];

				if (!statement || !ts.isExpressionStatement(statement))
					throw new Error("Expected an expression");

				return (statement.expression as ts.ParenthesizedExpression).expression as Comptime.Expr<any>;
			},
			createFunction: (_props) => {
				throw new Error("Not implemented");
			},
			literal: <T extends string | number | boolean>(value: T,): Comptime.Expr<T> => {
				return createLiteralExpression(value) as Comptime.Expr<T>;
			},
			call: (target: (...args: any[]) => any, ...args: any[]) => {
				return ts.factory.createCallExpression(ts.factory.createIdentifier(target.name), undefined, args.map(toExpression)) as any;
			}
		},

		source: {
			caller: () => {
				console.log(callerNode);
				throw new Error(
					"Source caller information is not implemented yet",
				);
			},
		},
	});
}

export class ComptimeCallResults {
	public readonly results: Record<string, ComptimeCallResult> = {};

	public reserveComptimeResult(packageName: string, node: ts.CallExpression): string {
		const length = Object.keys(this.results).length;
		const id = `${packageName}_${length}`;
		this.results[id] = { node };
		console.log("reserve", id);
		return id;
	}

	public getResultFromNode(node: ts.CallExpression) {
		return Object.values(this.results).find(r => r.node === node);
	}
}

export type ComptimeCallResult = {
	readonly node: ts.CallExpression;
	result?: any;
}