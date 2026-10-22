export declare const loadPackageJson: (path: string) => any;
export type PackageJson = {
    readonly name: string;
    readonly version: string;
    readonly ion: IonConfig;
};
export type IonConfig = {
    comptime?: {
        output?: string;
    };
};
