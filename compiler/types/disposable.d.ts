export declare const disposable: <T extends {}>(obj: T) => AsyncDisposable<T>;
export type AsyncDisposable<T> = T & {
    [Symbol.dispose]: () => Promise<void>;
};
