import { App, Plugin, requires } from "@ion/core";
import type { View } from "./view.js";
import type { Constructor } from "@ion/utils";
import { HttpPlugin, HttpServer } from "@ion/http";
import { Compiler } from "./client/compiler.js";
import path from "node:path";
import ts from "typescript";

export type JsxCompilerOptions = {
	App: Constructor<View>;
	/** The base path for the router */
	basePath: string;
};

@requires(HttpPlugin, { host: "localhost", port: 3001 })
export class JsxPlugin extends Plugin<JsxCompilerOptions> {
	override install(app: App): void {
		const server = app.getTransport(HttpServer);

		if (!server)
			return console.warn("Expected to have an http server!");
		const compiler = new Compiler();

		const bundle = compiler.compile(this.config.App);

		console.log("install jsx", bundle);
	}
}

export const jsxCompiler = (App: Constructor<View>, basePath: string) => new JsxPlugin({
	App,
	basePath
});
function hasClientDecorator(node: ts.ClassDeclaration): boolean {
	const decorators = ts.canHaveDecorators(node)
		? ts.getDecorators(node)
		: undefined;

	if (!decorators) return false;

	for (const d of decorators) {
		const expr = d.expression;

		if (ts.isCallExpression(expr)) {
			if (ts.isIdentifier(expr.expression) && expr.expression.text === "client") {
				return true;
			}
		}

		if (ts.isIdentifier(expr) && expr.text === "client") {
			return true;
		}
	}

	return false;
}

const clientFilterTransformer: ts.TransformerFactory<ts.SourceFile> = (context: ts.TransformationContext) => {
	const visitor: ts.Visitor = (node) => {

		if (ts.isClassDeclaration(node)) {
			if (!hasClientDecorator(node)) {
				return undefined;
			}
		}

		return ts.visitEachChild(node, visitor, context);
	};

	return (sourceFile: ts.SourceFile) => {
		const transformed = ts.visitNode(sourceFile, visitor) as ts.SourceFile;

		//const printer = ts.createPrinter();
		//const code = printer.printFile(transformed);

		//console.log(code);

		return transformed;
	};
};

@requires(HttpPlugin, { host: "localhost", port: 3001 })
export class JsxPlugin2 extends Plugin<{ appImportPath: string, basePath: string }> {
	override install(app: App): void {
		const server = app.getTransport(HttpServer);

		if (!server)
			return console.warn("Expected to have an http server!");

		const entryPath = path.resolve(app.srcDir, this.config.appImportPath);
		//console.log(entryPath);

		const program = ts.createProgram({
			rootNames: [entryPath],
			options: {
				"module": ts.ModuleKind.ESNext,
				"target": ts.ScriptTarget.ESNext,
				"outDir": "./dist",
				"rootDir": "./src",
				"moduleResolution": ts.ModuleResolutionKind.NodeNext,
				"experimentalDecorators": true,
				"emitDecoratorMetadata": true,
				"strict": true,
				"lib": [
					"ESNext",
					"DOM"
				],
				"types": [
					"node"
				],
				"skipLibCheck": true,
				"verbatimModuleSyntax": true,
				"moduleDetection": ts.ModuleDetectionKind.Force,
				"noUnusedLocals": true,
				"noUnusedParameters": true,
				"erasableSyntaxOnly": true,
				"noFallthroughCasesInSwitch": true,
				"noUncheckedSideEffectImports": true,
				"jsx": ts.JsxEmit.React,
				"jsxImportSource": "@ion/jsx"
			}
		});

		let output: string = "";

		program.emit(
			undefined,
			(_fileName, data) => { output = data; },
			undefined,
			false,
			{ before: [clientFilterTransformer] }
		);

		console.log({ output });
	}
}
export const jsxCompiler2 = (appImportPath: string, basePath: string = "/") => new JsxPlugin2({
	appImportPath,
	basePath
});