import { Module } from "../ast/module.js";
import { Compiler } from "../compiler.js";
import { Ast } from "../ast/ast.js";
export declare class ComptimeModuleTransformer {
    constructor();
    transform(compiler: Compiler, module: Module): Module;
}
export declare class AstTransformContext {
    createClass(_name: string): void;
}
export declare const createTransformFunction: (ctx: AstTransformContext) => <T extends Ast>(ast: T, transformer: (ast: Ast, ctx: AstTransformContext) => Ast) => T;
