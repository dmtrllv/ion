import { isSourceFile, SourceFile } from "typescript/ast";
import { Ast, EvaluationType } from "./ast.js";
import { cached } from "../utils.js";
import { isExported, Statement } from "./statement.js";
import assert from "node:assert";
import { Package } from "../package.js";

@Ast.register(isSourceFile)
export class Module extends Ast<SourceFile> {
	public override get evaluationType(): EvaluationType {
		return "constant";
	}
	
	@cached
	public get path(): string {
		return this.node.fileName;
	}

	@cached
	public get package(): Package {
		const pkg = this.compiler.resolvePackageFromModule(this.path);
		assert.ok(pkg);
		return pkg;
	}

	@cached
	public get statements() {
		return this.compiler.ast.resolveArray<Statement>(this.node.statements)
	}

	@cached
	public get exports() {
		return this.statements.filter(isExported);
	}
}