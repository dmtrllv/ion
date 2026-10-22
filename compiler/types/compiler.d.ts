import { API, ParsedCommandLine, Program } from "typescript/async";
import { AstTree } from "./ast/tree.js";
import { Package } from "./package.js";
import { Module } from "./ast/module.js";
export declare class Compiler {
    static readonly load: (root: string) => Promise<import("./disposable.js").AsyncDisposable<Compiler>>;
    readonly root: Package;
    readonly config: ParsedCommandLine;
    readonly api: API<false>;
    readonly program: Program<import("typescript/async").ProjectId>;
    readonly ast: AstTree;
    readonly packages: Map<string, Promise<Package>>;
    private constructor();
    resolvePackage(path: string): Promise<Package>;
    resolvePackageFromModule(module: Module): Promise<Package | undefined>;
    compile(): Promise<void>;
}
