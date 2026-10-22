import { Node } from "typescript/ast";
import { Compiler } from "../compiler.js";

export type NodeMatcher = (node: Node) => boolean;

export abstract class Ast<T extends Node = Node> {
	public static readonly register = (matcher: NodeMatcher) => <T extends AstConstructor<any, any>>(Class: T) => {
		Object.defineProperty(Class, "matcher", {
			configurable: true,
			get: () => matcher,
		});
	}

	private static get matcher(): NodeMatcher {
		throw new Error(`${this.name} has no registered ts.Node matcher!`);
	}

	public static tryParse<T extends typeof Ast<any>>(this: T, compiler: Compiler, node: Node): InstanceType<T> | undefined {
		if (this.matcher(node)) {
			const Class: AstConstructor<any, any> = this as any;
			return new Class(compiler, node);
		}
		return undefined;
	}

	protected readonly compiler: Compiler;
	protected readonly node: T;

	public constructor(compiler: Compiler, node: T) {
		this.compiler = compiler;
		this.node = node;
	}

	public get parent(): Ast | undefined {
		const parent = this.node.parent;
		return parent ? this.compiler.ast.resolve(parent) : undefined;
	}

	public readonly is = <T extends Ast<U>, U extends Node>(type: AstConstructor<T, U>): this is T => this instanceof type;

	public findParent<T extends Ast<U>, U extends Node>(type: AstConstructor<T, U>): T | undefined {
		let current = this.parent;

		while (current) {
			if (current instanceof type) return current;
			current = current.parent;
		}

		return undefined;
	}
}

export type AstConstructor<T extends Ast<U>, U extends Node> = new (compiler: Compiler, node: U) => T;