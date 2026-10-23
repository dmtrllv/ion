import { Ast } from "./ast.js";
import { Unknown } from "./unknown.js";
import { Module } from "./module.js";
import { Compiler } from "../compiler.js";
import { Node, NodeArray } from "typescript/ast";
import assert from "node:assert";
import { Variable, VariableStatement } from "./var.js";
import { Function } from "./function.js";
import { Class } from "./class.js";
import { SymbolFlags } from "typescript/sync";
import { Macro, MacroCall } from "./macro.js";
import { Import } from "./import.js";
import { ConstFn, ConstFnCall } from "./constfn.js";

export class AstTree {
	readonly #cache = new WeakMap<Node, Ast>();
	readonly #compiler: Compiler;

	public constructor(compiler: Compiler) {
		this.#compiler = compiler;
	}

	public readonly resolveArray = <T extends Ast<any> = Ast<any>>(nodes: Node[] | NodeArray<Node>): T[] => nodes.map(n => this.resolve<T>(n));

	public readonly resolve = <T extends Ast<any> = Ast<any>>(node: Node): T => {
		const cached = this.#cache.get(node);
		if (cached)
			return cached as T;

		const result = this.#parseNode(node);
		this.#cache.set(node, result);
		return result as T;
	}

	public readonly resolveModule = (path: string): Module => {
		const source = this.#compiler.program.getSourceFile(path);
		assert.ok(source, `Could not get source file for ${path}!`);
		return this.resolve(source) as Module;
	}

	readonly #parseNode = (node: Node): Ast => {
		for (const type of AstTypes) {
			const ast = type.tryParse(this.#compiler, node);
			if (ast)
				return ast;
		}
		return new Unknown(this.#compiler, node);
	}

	public resolveAliasedSymbol(node: Node) {
		const symbol = this.#compiler.checker.getSymbolAtLocation(node);
		if (symbol && (symbol?.flags & SymbolFlags.Alias))
			return this.#compiler.checker.getAliasedSymbol(symbol);
		return symbol;
	}

}

const AstTypes = [
	Macro,
	MacroCall,
	ConstFn,
	ConstFnCall,
	Import,
	Module,
	VariableStatement,
	Function,
	Variable,
	Class,
]