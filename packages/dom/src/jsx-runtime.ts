export * from "@ion/tsx/jsx-runtime";

import { JSX as TSX } from "@ion/tsx/jsx-runtime";

export namespace JSX {
	export interface IntrinsicElements {
		div: { children?: TSX.Children };
		img: { children?: never };
	}

	export interface IntrinsicAttributes { }

	export interface ElementChildrenAttribute {
		children: {};
	}
}