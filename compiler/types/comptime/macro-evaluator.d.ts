import { Module } from "../ast/module.js";
export declare class MacroEvaluator {
    constructor();
    evaluateModule(module: Module): Promise<void>;
}
