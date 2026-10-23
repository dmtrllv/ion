import { SourceFile } from "typescript/ast";
import { Ast } from "./ast.js";
import { Macro } from "./macro.js";
import { Statement } from "./statement.js";
import { Package } from "../package.js";
export declare class Module extends Ast<SourceFile> {
    get path(): string;
    get package(): Package;
    get statements(): Statement[];
    getMacroDeclarations(): Macro[];
    get exports(): Statement[];
    resolveComptimePath(): string;
}
