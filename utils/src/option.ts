export class Option<T> {
	private _hasData: boolean;
	private _data?: T | undefined;
	
	public static readonly some = <T>(value: T): SomeOption<T> => new Option({ value }) as SomeOption<T>;
	public static readonly none = <T>(): NoneOption<T> => new Option() as NoneOption<T>;

	private constructor(props?: { value: T }) {
		if(props) {
			this._data = props.value;
			this._hasData = true;
		} else {
			this._hasData = false;
		}
	}

	public hasData(): this is SomeOption<T> {
		return this._hasData;
	}

	protected get data(): T {
		if (!this._hasData)
			throw new Error(`Option is empty!`);
		return this._data!;
	}
}

export type SomeOption<T> = Option<T> & {
	get data(): T;
}

export type NoneOption<T> = Option<T>;