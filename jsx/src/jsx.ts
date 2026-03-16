import type { Constructor } from "@ion/utils";
import type { View, ViewProps } from "./view.js";

declare global {
	namespace JSX {
		type HtmlProps<T extends HTMLElement> = {
			children?: Children;
		} & {
			[K in keyof Omit<T, "children">]?: T[K]
		};

		type HtmlElements = {
			[K in keyof HTMLElementTagNameMap]: HtmlProps<HTMLElementTagNameMap[K]>;
		};

		type IntrinsicElements = HtmlElements;

		interface ElementChildrenAttribute {
			children: {};
		}

		type Children = JSX.Element | JSX.Element[];

		type WithChildren<P extends {} = {}> = P & { children: Children };

		type FC<P extends {} = {}> = (props: P) => JSX.Element;


		type PrimitiveElement = string | number | boolean | null;

		type ViewElement<T extends View<any>, Args extends any[]> = {
			type: Constructor<T, Args>,
			args: Args,
		};

		type SyncElement = PrimitiveElement | ViewElement<any, any>;
		type AsyncElement = Promise<SyncElement>;

		type Element = SyncElement | AsyncElement;
	}
}

export function jsx<K extends keyof JSX.IntrinsicElements>(tag: K, props: JSX.IntrinsicElements[K]): any;
export function jsx<T extends JSX.FC<P>, P extends {}>(fn: T, props: P): any;
export function jsx<T extends View<any>, Args extends any[]>(type: Constructor<T, Args>, ...args: Args): any;
export function jsx(...args: any[]): any {
	console.log("jsx", ...args);
}

export function jsxs(...args: any[]): any {
	console.log("jsxs", ...args);
}

export function Fragment(...args: any[]): any {
	console.log("Fragment", ...args);
}