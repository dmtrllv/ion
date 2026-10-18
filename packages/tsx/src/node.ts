import { scope, Scope } from "@ion/signal";
import { FRAGMENT, JSX } from "./jsx-runtime.js";

export abstract class Node {
	public parent: Node | null = null;
	public children: Node[] = [];

	public constructor(parent: Node | null = null) {
		this.parent = parent;
	}
}

export class ComponentNode<Props extends {} = any> extends Node {
	public readonly type: JSX.FC<Props>;
	public readonly component: Scope<JSX.Children>

	public props: Props;

	public constructor(type: JSX.FC<Props>, props: Props, parent?: Node) {
		super(parent);
		this.type = type;
		this.props = props;
		this.component = scope(() => type(this.props));
	}
}

export class NativeNode<T extends JSX.NativeElementType = JSX.NativeElementType> extends Node {
	public readonly type: T;
	public props: JSX.IntrinsicElements[T];

	public constructor(type: T, props: JSX.IntrinsicElements[T], parent?: Node) {
		super(parent);
		this.type = type;
		this.props = props;
	}
}

export class TextNode extends Node {
	value: string

	public constructor(value: string, parent?: Node) {
		super(parent);
		this.value = value;
	}
}

export class FragmentNode extends Node {

}

export class RootNode extends Node {

}

const parseChildren = (children: JSX.Children, parent: Node): Node[] => {
	children = Array.isArray(children) ? children : [children];
	return children.map(child => createNode(child, parent)).filter(s => !!s);
}

export const createNode = (element: JSX.Child, parent: Node) => {
	switch (typeof element) {
		case "number":
		case "string":
			return new TextNode(element.toString(), parent);
		case "object":
			if (element === null)
				return null;
			if (element.type === FRAGMENT) {
				const node = new FragmentNode();
				node.children = parseChildren(element.props.children, node);
				return node;
			} else if (typeof element.type === "function") {
				const node = new ComponentNode(element.type, element.props);
				node.children = parseChildren(element.props.children, node);
				return node;
			} else if (typeof element.type === "string") {
				const node = new NativeNode(element.type, element.props);
				node.children = parseChildren(element.props.children, node);
				return node;
			}
	}
	throw new Error(`Invalid element type "${typeof element}"!`);
};

export const createTree = (element: JSX.Element) => {
	const root = new RootNode();
	createNode(element, root);
	return root;
};