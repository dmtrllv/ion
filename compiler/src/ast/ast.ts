import ts from "typescript";
import { Compiler } from "../compiler.js";

export class Ast<T extends ts.Node = ts.Node> {
	protected readonly compiler: Compiler;
	protected readonly node: T;

	public constructor(compiler: Compiler, node: T) {
		this.compiler = compiler;
		this.node = node;
	}

	get parent(): Ast | undefined {
		const parent = this.node.parent;
		return parent ? this.compiler.ast.resolve(parent) : undefined;
	}

	public findParent<T extends Ast<U>, U extends ts.Node>(type: AstConstructor<T, U>): T | undefined {
		let current = this.parent;

		while (current) {
			if (current instanceof type) return current;
			current = current.parent;
		}

		return undefined;
	}
}

export type AstConstructor<T extends Ast<U>, U extends ts.Node> = new (node: U) => T;