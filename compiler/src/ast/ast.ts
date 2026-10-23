import { Node, SyntaxKind } from "typescript/ast";
import { Compiler } from "../compiler.js";
import { cached } from "../utils.js";
import { inspect } from "node:util";

export type NodeMatcher = (node: Node, compiler: Compiler) => boolean | Promise<boolean>;

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
		if (this.matcher(node, compiler)) {
			const Class: AstConstructor<any, any> = this as any;
			return new Class(compiler, node);
		}
		return undefined;
	}

	readonly #compiler: Compiler;
	readonly #node: T;

	@cached
	protected get compiler() { return this.#compiler };

	// @internal
	@cached
	public get node() { return this.#node; }

	public get source() {
		return this.#node.getText()
	}

	// @internal
	public constructor(compiler: Compiler, node: T) {
		this.#compiler = compiler;
		this.#node = node;
	}

	@cached
	public get parent(): Ast | undefined {
		if (this.node.parent)
			return this.compiler.ast.resolve(this.node.parent);
		return undefined;
	}

	public readonly is = <T extends Ast<U>, U extends Node>(type: AstConstructor<T, U> | (abstract new (compiler: Compiler, node: U) => T)): this is T => this instanceof type;
	public readonly isOneOf = <const T extends AstConstructor<any, any>[]>(...types: T): this is OneOf<T> => {
		return !!types.find(t => this instanceof t);
	};

	@cached
	public findParent<T extends Ast<U>, U extends Node>(type: AstConstructor<T, U>): T | undefined {
		let current = this.parent;

		while (current) {
			if (current instanceof type)
				return current;
			current = current.parent;
		}

		return undefined;
	}

	@cached
	public getChildren(): Ast[] {
		return this.node.getChildren().map(this.compiler.ast.resolve);
	}

	public findChildren<T extends Ast<U>, U extends Node>(type: AstConstructor<T, U>): T[] {
		const children = this.getChildren();
		return children.filter(s => s.is(type));
	}

	[inspect.custom]() {
		return this.debug();
	}

	protected debug() {
		let buffer = "";
		const printAst = (node: Node, indent: number) => {
			const prefix = "  ".repeat(indent);
			const kind = SyntaxKind[node.kind];
			let text = node.getText().replace(/\s+/g, " ");
			if (text.length > 20)
				text = text.slice(0, 17) + "...";
			buffer += `${prefix}${kind}: ${text}\n`;
			node.forEachChild(child => printAst(child, indent + 2));
		}

		printAst(this.node, 0);
		return buffer;
	}
}

export type AstConstructor<T extends Ast<U>, U extends Node> = new (compiler: Compiler, node: U) => T;

export type OneOf<T extends AstConstructor<any, any>[]> = T[number];