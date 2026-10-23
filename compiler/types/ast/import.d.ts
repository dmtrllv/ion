import * as ts from "typescript/ast";
import { Ast } from "./ast.js";
import { Module } from "./module.js";
export declare class Import extends Ast<ts.ImportDeclaration> {
    get path(): string;
    getModule(): Module;
}
