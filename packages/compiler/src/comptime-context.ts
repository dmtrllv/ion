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

export const toExpression = (value: unknown): ts.Expression => {
	if (value !== null && typeof value === "object" && "kind" in value) {
		const node = value as ts.Node;

		if (ts.isExpression(node)) {
			return node;
		}
	}

	if (value === null) {
		return ts.factory.createNull();
	}

	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
		return createLiteralExpression(value);
	}

	if (Array.isArray(value)) {
		return ts.factory.createArrayLiteralExpression(value.map(toExpression), true);
	}

	if(typeof value === "function") {

	}

	if (typeof value === "object") {
		if ("kind" in value && ts.isExpression(value as ts.Node)) {
			return value as ts.Expression;
		}

		return ts.factory.createObjectLiteralExpression(Object.entries(value).map(([key, val]) => ts.factory.createPropertyAssignment(ts.factory.createStringLiteral(key), toExpression(val),),), true,);
	}
	console.log(`value is not a compile time value`, value);
	return ts.factory.createIdentifier("undefined");

	//throw new Error(
	//	`Cannot convert ${typeof value} to a TypeScript expression`,
	//);

	//const str = typeof value === "function" ? value.toString() : JSON.stringify(value);
	//const sourceFile = ts.createSourceFile("comptime-expr-wrapper", `(${str});`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

	//const statement = sourceFile.statements[0];

	//if (!statement || !ts.isExpressionStatement(statement) || !ts.isParenthesizedExpression(statement.expression)) {
	//	throw new Error("Invalid expression");
	//}

	//console.log({ x: statement?.expression.expression.getText() });
	//return statement.expression.expression;
};

export const createContext = (_callerNode: ts.CallExpression | undefined = undefined, functionReferences: any[] = []): Comptime.Context => {
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
				functionReferences.push(target);
				return ts.factory.createCallExpression(ts.factory.createIdentifier(target.name), undefined, args.map(arg => toExpression(arg))) as any;
			}
		},

		source: {
			caller: () => {
				throw new Error(
					"Source caller information is not implemented yet",
				);
			},
		},
	});
}
