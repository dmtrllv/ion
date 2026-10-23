export type ComptimeManifest = {
    exports: {
        [path: string]: CopmtimeModuleExports;
    };
};
export type CopmtimeModuleExports = {
    [ident: string]: string;
};
export declare const createManifest: () => void;
