import { Node } from "typescript/ast";
import { Compiler } from "../compiler.js";
export type NodeMatcher = (node: Node, compiler: Compiler) => boolean;
export declare abstract class Ast<T extends Node = Node> {
    #private;
    static readonly register: (matcher: NodeMatcher) => <T_1 extends AstConstructor<any, any>>(Class: T_1) => void;
    private static get matcher();
    static tryParse<T extends typeof Ast<any>>(this: T, compiler: Compiler, node: Node): InstanceType<T> | undefined;
    protected get compiler(): Compiler;
    protected get node(): T;
    constructor(compiler: Compiler, node: T);
    get parent(): Ast | undefined;
    readonly is: <T_1 extends Ast<U>, U extends Node>(type: AstConstructor<T_1, U>) => this is T_1;
    readonly isOneOf: <const T_1 extends AstConstructor<any, any>[]>(...types: T_1) => this is OneOf<T_1>;
    findParent<T extends Ast<U>, U extends Node>(type: AstConstructor<T, U>): T | undefined;
}
export type AstConstructor<T extends Ast<U>, U extends Node> = new (compiler: Compiler, node: U) => T;
export type OneOf<T extends AstConstructor<any, any>[]> = T[number];
