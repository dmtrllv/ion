import type { Constructor } from "@ion/utils";
import type { View } from "./view.js";

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

		//type FC<P extends {} = {}> = (props: P) => JSX.Element;


		type PrimitiveElement = string | number | boolean | null;

		type ViewElement<T extends View<P>, P extends {}> = {
			type: Constructor<T>;
			props: P;
		};

		type HtmlElement<T extends keyof HtmlElements> = {
			type: T;
			props: HtmlElements[T];
			children: Element[];
		};

		type FragmentElement = {
			type: typeof Fragment,
			children: Element[];
		}

		type SyncElement = PrimitiveElement | ViewElement<any, any> | HtmlElement<keyof HtmlElements> | FragmentElement;
		type AsyncElement = Promise<SyncElement>;

		type Element = SyncElement | AsyncElement;
	}
}

export function jsx<K extends keyof JSX.HtmlElements>(tag: K, props: JSX.HtmlElements[K]): JSX.HtmlElement<K>;
//export function jsx<T extends JSX.FC<P>, P extends {}>(fn: T, props: P): JSX.;
export function jsx<T extends View<any>, Args extends any[]>(type: Constructor<T, Args>, ...args: Args): JSX.ViewElement<T, Args>;
export function jsx(type: any, props: any = {}): any {
	const children = props.children || [];
	return {
		type,
		props,
		children: Array.isArray(children) ? props.children : [props.children]
	};
}

export function jsxs(type: typeof Fragment, { children }: { children: JSX.Element[] }): JSX.FragmentElement {
	return {
		type,
		children,
	}
}

export function Fragment(...args: any[]): any {
	throw new Error("TODO jsx.Fragment", ...args);
}
