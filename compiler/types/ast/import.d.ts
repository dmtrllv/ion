import * as ts from "typescript/ast";
import { Ast, EvaluationType } from "./ast.js";
import { Module } from "./module.js";
export declare class Import extends Ast<ts.ImportDeclaration> {
    get evaluationType(): EvaluationType;
    get path(): string;
    getModule(): Module;
}
