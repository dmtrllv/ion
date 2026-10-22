import { PackageJson } from "./package-json.js";
import { ComptimeManifest } from "./manifest.js";
import { API, ParsedCommandLine } from "typescript/async";
export declare class Package {
    #private;
    static load(api: API<false>, path: string): Promise<Package>;
    readonly tsConfig: ParsedCommandLine | undefined;
    readonly path: string;
    readonly json: PackageJson;
    readonly comptimeManifest: ComptimeManifest | undefined;
    get name(): string;
    get version(): string;
    get isComptime(): boolean;
    get sourcePath(): string;
    get outputPath(): string;
    get comptimePath(): string;
    get sourceFilePaths(): import("typescript/proto").RootedFilePath[];
    private constructor();
    comptimePathFromOutputPath(path: string): string;
    resolveSourcePathFromOutputPath(path: string): string;
}
