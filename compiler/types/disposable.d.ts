export declare const asyncDisposable: <T extends {}>(obj: T) => AsyncDisposable<T>;
export type AsyncDisposable<T> = T & {
    [Symbol.asyncDispose]: () => Promise<void>;
};
