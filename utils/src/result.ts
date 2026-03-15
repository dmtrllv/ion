export class Result<T, E> {
	private _isError: boolean;
	private _data?: T | undefined;
	private _error?: E | undefined;

	public static readonly ok = <T, E>(value: T): OkResult<T, E> => new Result({ value }) as OkResult<T, E>;
	public static readonly err = <T, E>(error: E): ErrResult<T, E> => new Result({ error }) as ErrResult<T, E>;

	public static readonly try = <T>(callback: () => T): Result<T, unknown> => {
		try {
			return this.ok(callback());
		} catch (e) {
			return this.err(e);
		}
	}

	public static readonly tryAsync = async <T>(callback: () => Promise<T>): Promise<Result<T, unknown>> => {
		try {
			return this.ok(await callback());
		} catch (e) {
			return this.err(e);
		}
	}

	private constructor(props: { value: T } | { error: E }) {
		if ("value" in props) {
			this._isError = false;
			this._data = props.value;
		} else {
			this._isError = true;
			this._error = props.error;
		}
	}

	public isOk(): this is OkResult<T, E> {
		return !this._isError;
	}

	public isErr(): this is ErrResult<T, E> {
		return this._isError;
	}

	protected get data(): T {
		if (this.isErr())
			throw new Error(`Result contained an error!`);
		return this._data!;
	}

	protected get error(): E {
		if (!this.isErr())
			throw new Error(`Result did not contain an error!`);
		return this._error!;
	}

	public match<R>(matcher: ResultMatcher<T, E, R>): R {
		if (this.isOk()) {
			return matcher.Ok(this._data!);
		} else {
			return matcher.Err(this._error!);
		}
	}

	public map<U>(mapper: (value: T) => U): Result<U, E> {
		if (this.isOk()) {
			return Ok(mapper(this.data));
		}
		return this as unknown as Result<U, E>;
	}

	public mapErr<U extends E>(mapper?: (err: E) => U): Result<T, U>
	public mapErr<U>(mapper: (err: E) => U): Result<T, U>
	public mapErr<U>(mapper?: (err: E) => U): Result<T, U> {
		if (this.isErr()) {
			return Err(mapper ? mapper(this.error) : this.error as unknown as U);
		}
		return this as unknown as Result<T, U>;
	}

	public andThen<U>(mapper: (value: T) => Promise<Result<U, E>>): Promise<Result<U, E>>;
	public andThen<U>(mapper: (value: T) => Result<U, E>): Result<U, E>;
	public andThen<U>(mapper: (value: T) => any): any {
		if (this.isOk()) {
			return mapper(this.data);
		}
		return this as unknown as Result<U, E>;
	}

	public or<U>(defaultValue: U): U | T {
		return this.match({
			Ok: v => v,
			Err: _ => defaultValue as U | T,
		});
	}
}

export type ResultMatcher<T, E, R> = {
	Ok(value: T): R;
	Err(error: E): R;
}

export type OkResult<T, E> = Result<T, E> & {
	get data(): T;
};

export type ErrResult<T, E> = Result<T, E> & {
	get error(): E;
}

export function Ok<T, E>(): Result<void, E>;
export function Ok<T, E>(data: T): Result<T, E>;
export function Ok<T, E>(data?: T): Result<T, E> {
	return Result.ok(data) as Result<T, E>;
}

export const Err = <T, E>(error: E): Result<T, E> => Result.err(error);
