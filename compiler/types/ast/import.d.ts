import { ImportDeclaration } from "typescript/ast";
import { Ast } from "./ast.js";
export declare class Import extends Ast<ImportDeclaration> {
    get path(): string;
    getModule(): Promise<import("./module.js").Module>;
}
