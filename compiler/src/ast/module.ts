import { isSourceFile, SourceFile } from "typescript/ast";
import { Ast } from "./ast.js";
import { cached } from "../utils.js";
import { Macro } from "./macro.js";
import { isExported, Statement } from "./statement.js";
import assert from "node:assert";
import { Package } from "../package.js";

@Ast.register(isSourceFile)
export class Module extends Ast<SourceFile> {
	@cached
	public get path(): string {
		return this.node.fileName;
	}

	@cached
	public get package(): Package {
		const pkg = this.compiler.resolvePackageFromModule(this);
		assert.ok(pkg);
		return pkg;
	}

	@cached
	public get statements() {
		return this.compiler.ast.resolveArray<Statement>(this.node.statements)
	}

	@cached
	public getMacroDeclarations(): Macro[] {
		const statements = this.statements;
		return statements.filter(stmt => stmt.is(Macro));
	}

	@cached
	public get exports() {
		return this.statements.filter(isExported);
	}

	@cached
	public resolveComptimePath() {
		const pkg = this.package;
		console.log(pkg.isComptime)
		if (!pkg.isComptime)
			return this.path;

		let path: string | undefined;
		if (this.path.startsWith(pkg.typeDeclarationPath)) {
			path = this.path.replace(pkg.typeDeclarationPath, pkg.comptimePath).replace(/\.d\.tsx?$/i, ".js");
		} else if (this.path.startsWith(pkg.sourcePath)) {
			path = this.path.replace(pkg.sourcePath, pkg.comptimePath).replace(/\.tsx?$/i, ".js");
		}
		assert.ok(path);
		return path;
	}

}