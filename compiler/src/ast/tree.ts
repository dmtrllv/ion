import ts from "typescript";
import { Ast } from "./ast.js";
import { Unknown } from "./unknown.js";
import { Module } from "./module.js";
import { Compiler } from "../compiler.js";

export class AstTree {
	private readonly cache = new WeakMap<ts.Node, Ast>();
	private readonly compiler: Compiler;

	public constructor(compiler: Compiler) {
		this.compiler = compiler;
	}

	public resolve<T extends Ast>(node: ts.Node): T {
		const cached = this.cache.get(node);
		if (cached)
			return cached as T;

		const result = this.parseNode(node);
		this.cache.set(node, result);
		return result as T;
	}

	private parseNode(node: ts.Node): Ast {
		if (ts.isSourceFile(node)) return new Module(this.compiler, node);

		return new Unknown(this.compiler, node);
	}
}