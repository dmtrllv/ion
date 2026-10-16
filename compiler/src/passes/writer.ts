import * as ts from "typescript";
import { Pass } from "./pass.js";
import { Compiler } from "../compiler.js";
import { TransformedModule } from "./transformer.js";

export class ComptimeWriter implements Pass<void, [TransformedModule[], Map<ts.CallExpression, ts.Expression>]>
{
	public async run(
		compiler: Compiler,
		_modules: TransformedModule[],
		results: Map<ts.CallExpression, ts.Expression>,
	) {
		const transformer: ts.TransformerFactory<ts.SourceFile> =
			(context) => {
				const visit: ts.Visitor = (node) => {
					if (ts.isCallExpression(node)) {
						const result = results.get(node);

						if (result !== undefined) {
							return result;
						}
					}

					return ts.visitEachChild(node, visit, context);
				};

				return (sourceFile) =>
					ts.visitNode(sourceFile, visit) as ts.SourceFile;
			};

		const emitResult = compiler.program.emit(
			undefined,
			undefined,
			undefined,
			false,
			{
				before: [transformer],
			},
		);

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
}