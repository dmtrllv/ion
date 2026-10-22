import { Ast } from "./ast.js";
import { Module } from "./module.js";
import { Compiler } from "../compiler.js";
import { Node, NodeArray } from "typescript/ast";
export declare class AstTree {
    #private;
    constructor(compiler: Compiler);
    readonly resolveArray: <T extends Ast<any> = Ast<any>>(nodes: Node[] | NodeArray<Node>) => T[];
    readonly resolve: <T extends Ast<any> = Ast<any>>(node: Node) => T;
    readonly resolveModule: (path: string) => Promise<Module>;
}
