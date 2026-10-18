export function jsx<Props extends {}>(fc: JSX.FC<Props>, props: Props, key?: string | number): JSX.Element;
export function jsx<T extends JSX.NativeElementType>(type: T, props: JSX.IntrinsicElements[T], key?: string | number): JSX.Element;
export function jsx(fragment: typeof FRAGMENT, props: JSX.WithChildren): JSX.Element;
export function jsx(type: any, props: any = {}, key?: string | number): JSX.Element {
	return {
		type,
		props,
		key
	};
}

export const FRAGMENT = Symbol("Fragment");

export namespace JSX {

	export type FC<Props extends {} = {}> = (props: Props) => JSX.Children;

	export type Children = Child | Child[];

	export type WithChildren<Props extends {} = {}, ChildrenType = Children> = Props & {
		children: ChildrenType;
	};

	export type Child =
		| Element
		| null
		| number
		| string;

	export interface FCElement<Props extends {}> {
		type: FC<Props>;
		props: Props;
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

	export interface IntrinsicElements { }
}