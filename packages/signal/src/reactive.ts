import { Effect } from "./effect.js";
import { Memo } from "./memo.js";

// @internal
export interface ReactiveSource {
	addObserver(observer: ReactiveObserver): void;
	removeObserver(observer: ReactiveObserver): void;
}

// @internal
export interface ReactiveObserver {
	/**
	 * Tracks an reactive object
	 * @param source the reactive object that this observer will track
	 */
	track(source: ReactiveSource): void;

	/**
	 * Marks this object as stale
	 */
	invalidate(): void;
}

let activeObserver: ReactiveObserver | null = null;

// @internal
export const trackDependency = (source: ReactiveSource): void => {
	activeObserver?.track(source);
};

// @internal
export const withObserver = <T>(observer: ReactiveObserver, closure: () => T): T => {
	const previous = activeObserver;
	activeObserver = observer;

	try {
		return closure();
	} finally {
		activeObserver = previous;
	}
};

export type Unsubscriber = () => boolean;

export type ReactiveResult<T> = {
	readonly data: T;
	readonly error?: undefined;
	readonly source?: undefined;
} | {
	readonly data?: undefined;
	readonly error: Error;
	readonly source: Memo<any> | Effect;
};