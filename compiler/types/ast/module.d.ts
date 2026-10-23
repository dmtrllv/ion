import { SourceFile } from "typescript/ast";
import { Ast } from "./ast.js";
import { Macro } from "./macro.js";
export declare class Module extends Ast<SourceFile> {
    get path(): string;
    get package(): Promise<import("../package.js").Package | undefined>;
    get statements(): Promise<Ast<any>[]>;
    getMacroDeclarations(): Promise<Macro[]>;
    get exports(): Promise<Ast<any>[]>;
}
