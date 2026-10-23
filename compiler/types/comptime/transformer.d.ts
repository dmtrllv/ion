import { Module } from "../ast/module.js";
import { Compiler } from "../compiler.js";
export declare class ComptimeModuleTransformer {
    constructor();
    transform(compiler: Compiler, module: Module): string;
}
