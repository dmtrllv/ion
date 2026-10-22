import { SourceFile } from "typescript/ast";
import { Ast } from "./ast.js";
import { Statement } from "./statement.js";
export declare class Module extends Ast<SourceFile> {
    get path(): string;
    get package(): Promise<import("../package.js").Package | undefined>;
    get statements(): Statement[];
}
