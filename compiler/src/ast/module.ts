import ts from "typescript";
import { Ast } from "./ast.js";
import { cached } from "../utils.js";
import { Package } from "../package.js";

export class Module extends Ast<ts.SourceFile> {
	@cached
	public get package() {
		return Package.fromModulePath(this.node.fileName);
	}

	@cached
	public get imports() {
		
	}

	//public constructor(node: ts.SourceFile) {
	//	super(node);
	//}
}