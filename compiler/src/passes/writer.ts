import * as ts from "typescript";
import { Pass } from "./pass.js";
import { Compiler } from "../compiler.js";

export class ComptimeWriter implements Pass<void, [Map<ts.CallExpression, ts.Expression>]> {
	public async run(compiler: Compiler, results: Map<ts.CallExpression, ts.Expression>) {
		const emitResult = compiler.program.emit(undefined, undefined, undefined, false, { before: [this.transformer(results)] });

		if (emitResult.emitSkipped) {
			const diagnostics = ts.formatDiagnosticsWithColorAndContext(
				emitResult.diagnostics,
				{
					getCurrentDirectory: ts.sys.getCurrentDirectory,
					getCanonicalFileName: (fileName) => fileName,
					getNewLine: () => ts.sys.newLine,
				},
			);

			throw new Error(`TypeScript emit failed:\n${diagnostics}`);
		}
	}

	private readonly transformer = (results: Map<ts.CallExpression, ts.Expression>): ts.TransformerFactory<ts.SourceFile> => (context) => {
		const visit: ts.Visitor = (node) => {
			if (ts.isCallExpression(node)) {
				const result = results.get(node);

				if (result !== undefined) {
					return result;
				}
			}

			return ts.visitEachChild(node, visit, context);
		};

		return (sourceFile) => ts.visitNode(sourceFile, visit) as ts.SourceFile;
	}
}