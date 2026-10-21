import ts from "typescript";
import { Module } from "../module.js";
import assert from "node:assert";

export class ComptimeModule {
	public readonly module: Module;
	public readonly comptimeSource: string;

	public constructor(module: Module, comptimeSource: string) {
		this.module = module;
		this.comptimeSource = comptimeSource;

		const result = ts.transform(module.sourceFile, [this.transformer], { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.NodeNext });

		try {
			const transformedSourceFile = result.transformed[0];
			assert.ok(transformedSourceFile);

			this.comptimeSource = ts.createPrinter().printFile(transformedSourceFile)
		} finally {
			result.dispose();
		}
	}

	private readonly transformer: ts.TransformerFactory<ts.SourceFile> = () => {
		return sourceFile => {
			const statements: ts.Statement[] = [];
			for (const stmt of sourceFile.statements) {
				if (ts.isVariableStatement(stmt)) {
					//const hasExport = stmt.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;

					const keptDeclarations: ts.VariableDeclaration[] = [];

					for (const decl of stmt.declarationList.declarations) {
						//if (this.module.comptimeDecl.find(d => d.declaration === decl)) {
						//	if (!hasExport) {
						//		const name = (decl.name as ts.Identifier).text
						//		const exports = ts.factory.createNamedExports([ts.factory.createExportSpecifier(false, undefined, ts.factory.createIdentifier(name))])
						//		const exportDeclaration = ts.factory.createExportDeclaration(undefined, false, exports, undefined);
						//		statements.push(exportDeclaration);
						//	}
						//	keptDeclarations.push(decl);
						//} else if (this.isComptimeBindingOrCall(decl)) {
							keptDeclarations.push(decl);
						//}
					}
					const declList = ts.factory.createVariableDeclarationList(keptDeclarations, stmt.declarationList.flags);
					const updatedStmt = ts.factory.updateVariableStatement(stmt, stmt.modifiers, declList);
					statements.push(updatedStmt);
				} else {
					statements.push(stmt);
				}
			}
			return ts.factory.updateSourceFile(sourceFile, statements);
		};
	}
}