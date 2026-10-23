import { Ast } from "./ast.js";
import { Module } from "./module.js";
import { Compiler } from "../compiler.js";
import { Node, NodeArray } from "typescript/ast";
export declare class AstTree {
    #private;
    constructor(compiler: Compiler);
    readonly resolveArray: <T extends Ast<any> = Ast<any>>(nodes: Node[] | NodeArray<Node>) => Promise<T[]>;
    readonly resolve: <T extends Ast<any> = Ast<any>>(node: Node) => Promise<T>;
    readonly resolveModule: (path: string) => Promise<Module>;
    resolveAliasedSymbol(node: Node): Promise<import("typescript/async").Symbol | undefined>;
}
