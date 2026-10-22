import { isSourceFile, SourceFile } from "typescript/ast";
import { Ast } from "./ast.js";
import { cached } from "../utils.js";
import { Statement } from "./statement.js";

@Ast.register(isSourceFile)
export class Module extends Ast<SourceFile> {
	@cached
	public get path(): string {
		return this.node.fileName;
	}

	@cached
	public get package() {
		return this.compiler.resolvePackageFromModule(this)
	}

	@cached
	public get statements(): Statement[] {
		return this.compiler.ast.resolveArray(this.node.statements)
	}
}