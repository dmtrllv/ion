import ts from "typescript";
import { Package } from "./package.js";
import { Compiler } from "./compiler.js";
import { ComptimeDeclaration } from "./comptime/item.js";
//import { ComptimeDeclaration } from "./comptime/item.js";
//import { Import } from "./import.js";
//import { Export } from "./export.js";

export class Module {
	public readonly package: Package;
	public readonly path: string;
	public readonly sourceFile: ts.SourceFile;

	public readonly comptimeDecl: ComptimeDeclaration[];

	public constructor(compiler: Compiler, sourceFile: ts.SourceFile, pkg: Package, path: string) {
		this.package = pkg;
		this.path = path;
		this.sourceFile = sourceFile;
		this.comptimeDecl = this.resolveComptimeDeclarations(compiler);
	}

	private resolveComptimeDeclarations(compiler: Compiler): ComptimeDeclaration[] {
		const comptimeDecls: ComptimeDeclaration[] = [];
		this.sourceFile.statements.forEach(stmt => {
			if (ts.isVariableStatement(stmt)) {
				comptimeDecls.push(...compiler.comptimeResolver.resolveVarDeclarations(stmt));
			}
			//todo class statics block?
		});
		if (comptimeDecls.length)
			console.log(comptimeDecls.map(c => [c.symbol.name, c.type]))
		return comptimeDecls;
	}

}