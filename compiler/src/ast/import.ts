import * as ts from "typescript/ast";
import { Ast } from "./ast.js";

@Ast.register(ts.isImportDeclaration)
export class Import extends Ast<ts.ImportDeclaration> {
	
}