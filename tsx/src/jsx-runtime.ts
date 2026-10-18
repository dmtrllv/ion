export function jsx<P extends JSX.Props>(fc: JSX.FC<P>, props: P, key?: string | number): JSX.Element;
export function jsx<T extends JSX.NativeElementType>(type: T, props: JSX.IntrinsicElements[T], key?: string | number): JSX.Element;
export function jsx(fragment: typeof FRAGMENT, props: JSX.WithChildren): JSX.Element;
export function jsx(type: any, props: any = {}, key?: string | number): JSX.Element {
	return {
		type,
		props,
		key
	};
}

export const test = () => {}

export const FRAGMENT = Symbol("Fragment");

export namespace JSX {
	export type Props = { children?: never };

	export type FC<P extends Props = Props> = (props: P) => JSX.Children;

	export type Children = Child | Child[];

	export type WithChildren<P extends Props = Props, ChildrenType = Children> = Omit<P, "children"> & {
		children: ChildrenType;
	};

	export type Child =
		| Element
		| null
		| number
		| string;

	export interface FCElement<P extends Props> {
		type: FC<P>;
		props: P;
		key?: string | number
	};

	export interface FragmentElement {
		type: typeof FRAGMENT;
		props: WithChildren;
	};

	export type NativeElementType = keyof JSX.IntrinsicElements;

	export interface NativeElement<Type extends NativeElementType> {
		type: Type;
		props: JSX.IntrinsicElements[Type];
		key?: string | number;
	};

	export type Element =
		| FCElement<any>
		| FragmentElement
		| NativeElement<NativeElementType>;

	export interface IntrinsicElements {
		[key: string]: any;
	}
	
	//type Widen<
	//Type, To> = [Type] extends [never] ? To & Type : Type;
}
