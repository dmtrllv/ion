import { API, Checker, ParsedCommandLine, Program } from "typescript/async";
import { AstTree } from "./ast/tree.js";
import { Package } from "./package.js";
import { Module } from "./ast/module.js";
export declare class Compiler {
    static readonly load: (root: string) => Promise<import("./disposable.js").AsyncDisposable<Compiler> | undefined>;
    readonly root: Package;
    readonly config: ParsedCommandLine;
    readonly api: API<false>;
    readonly program: Program;
    readonly checker: Checker;
    readonly ast: AstTree;
    readonly nodeModulesPath: string;
    readonly packages: Map<string, Promise<Package>>;
    getComptimeSymbols(): Promise<import("./comptime/symbols.js").ComptimeSymbols | undefined>;
    private constructor();
    resolvePackage(path: string): Promise<Package>;
    resolvePackageFromModule(module: Module): Promise<Package | undefined>;
    compile(): Promise<void>;
}
