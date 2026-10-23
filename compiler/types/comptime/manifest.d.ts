import { Compiler } from "../compiler.js";
export declare class ComptimeManifest {
    static load: (path: string) => ComptimeManifest;
    static create: (compiler: Compiler) => void;
    readonly exports: Readonly<Record<string, Readonly<CopmtimeModuleExports>>>;
    private constructor();
}
export type CopmtimeModuleExports = {
    [ident: string]: string;
};
