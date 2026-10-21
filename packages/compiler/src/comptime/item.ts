import ts from "typescript";

export type ComptimeItem = ComptimeDeclaration | ComptimeExpression;

export type ComptimeDeclaration = {
	readonly declaration: ts.VariableDeclaration;
	readonly type: ComptimeType;
	readonly symbol: ts.Symbol;
};

export type ComptimeExpression = {
	readonly expression: ts.Expression;
	readonly type: ComptimeType;
	readonly dependencies: ComptimeItem[];
};

export type ComptimeType =
	| "decl"
	| "value"
	| "fn.decl"
	| "fn.call"
	| "macro.decl"
	| "macro.call";

export type ComptimeSymbol = ts.Symbol & {
	readonly type: ComptimeType;
};

export const isComptimeSymbol = (symbol: ts.Symbol): symbol is ComptimeSymbol => {
	return "type" in symbol;
};