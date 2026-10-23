import { isSourceFile, SourceFile } from "typescript/ast";
import { Ast } from "./ast.js";
import { cached } from "../utils.js";
import { Macro } from "./macro.js";
import { isExported } from "./statement.js";

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
	public get statements() {
		return this.compiler.ast.resolveArray(this.node.statements)
	}

	@cached
	public async getMacroDeclarations(): Promise<Macro[]> {
		const statements = await this.statements;
		return statements.filter(stmt => stmt.is(Macro));
	}

	@cached
	public get exports() {
		return this.statements.then(s => s.filter(isExported));
	}
}