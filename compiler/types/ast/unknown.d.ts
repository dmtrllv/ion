import { Node } from "typescript/ast";
import { Ast, EvaluationType } from "./ast.js";
export declare class Unknown extends Ast<Node> {
    get evaluationType(): EvaluationType;
}
