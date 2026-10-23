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
import { Macro } from "./macro.js";

export class AstTree {
	readonly #cache = new WeakMap<Node, Promise<Ast>>();
	readonly #compiler: Compiler;

	public constructor(compiler: Compiler) {
		this.#compiler = compiler;
	}

	public readonly resolveArray = async <T extends Ast<any> = Ast<any>>(nodes: Node[] | NodeArray<Node>): Promise<T[]> => Promise.all(nodes.map(n => this.resolve<T>(n)));

	public readonly resolve = async <T extends Ast<any> = Ast<any>>(node: Node): Promise<T> => {
		const cached = this.#cache.get(node);
		if (cached)
			return cached as Promise<T>;

		const result = this.#parseNode(node);
		this.#cache.set(node, result);
		return await result as T;
	}

	public readonly resolveModule = async (path: string): Promise<Module> => {
		const source = await this.#compiler.program.getSourceFile(path);
		assert.ok(source);
		return this.resolve(source) as Promise<Module>;
	}

	readonly #parseNode = async (node: Node): Promise<Ast> => {
		for (const type of AstTypes) {
			const ast = await type.tryParse(this.#compiler, node);
			if (ast)
				return ast;
		}
		return new Unknown(this.#compiler, node);
	}

	public async resolveAliasedSymbol(node: Node) {
		const symbol = await this.#compiler.checker.getSymbolAtLocation(node);
		if (symbol && (symbol?.flags & SymbolFlags.Alias))
			return this.#compiler.checker.getAliasedSymbol(symbol);
		return symbol;
	}

}

const AstTypes = [
	Macro,
	Module,
	VariableStatement,
	Function,
	Variable,
	Class,
]