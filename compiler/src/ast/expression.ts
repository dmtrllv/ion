import { Node } from "typescript/ast";
import { Ast } from "./ast.js";

export abstract class Expression<T extends Node = Node> extends Ast<T> {
	public abstract get evaluationType(): EvaluationType;
}

export type EvaluationType = 
| "comptime"
| "runtime"
| "constant";