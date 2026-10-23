import { SourceFile } from "typescript/ast";
import { Ast, EvaluationType } from "./ast.js";
import { Statement } from "./statement.js";
import { Package } from "../package.js";
export declare class Module extends Ast<SourceFile> {
    get evaluationType(): EvaluationType;
    get path(): string;
    get package(): Package;
    get statements(): Statement[];
    get exports(): Statement[];
}
