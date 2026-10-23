import { API, Checker, ParsedCommandLine, Program, ModuleResolver } from "typescript/sync";
import { AstTree } from "./ast/tree.js";
import { Package } from "./package.js";
export declare class Compiler {
    static readonly load: (root: string) => import("./disposable.js").AsyncDisposable<Compiler> | undefined;
    readonly root: Package;
    readonly config: ParsedCommandLine;
    readonly api: API<false>;
    readonly program: Program;
    readonly checker: Checker;
    readonly ast: AstTree;
    readonly nodeModulesPath: string;
    readonly packages: Map<string, Package>;
    getComptimeSymbols(): import("./comptime/symbols.js").ComptimeSymbols | undefined;
    private constructor();
    createResolver(): ModuleResolver;
    resolvePackage(path: string): Package;
    resolvePackageFromModule(modulePath: string): Package | undefined;
    compile(options: {
        type: "app" | "lib";
    }): void;
}
