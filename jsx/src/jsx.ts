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

		type PrimitiveElement = string | number | boolean | null;

		type FC<P extends {} = {}> = (props: P) => JSX.Element;

		type SyncElement = PrimitiveElement;
		type AsyncElement = Promise<SyncElement>;

		type Element = SyncElement | AsyncElement;
	}
}

export function jsx(...args: any[]): any {
	console.log("jsx", ...args);
}


export function jsxs(...args: any[]): any {
	console.log("jsxs", ...args);
}

