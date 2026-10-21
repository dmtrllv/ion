import ts from "typescript";
import { Package } from "./package.js";
import { ComptimeItem } from "./comptime.js";
import { Compiler } from "./compiler.js";
import assert from "node:assert";
import { cached } from "./utils.js";

export class Module {
	public readonly path: string;
	public readonly package: Package;
	public readonly sourceFile: ts.SourceFile;
	public readonly comptimeDeclarations: Map<string, ComptimeItem>;

	@cached
	public get comptimePath(): string {
		return this.path.replace(this.package.sourceDir, this.package.comptimeOutput).replace(/\.tsx?$/, ".js");
	}

	@cached
	public get buildPath(): string {
		return this.path.replace(this.package.sourceDir, this.package.buildDir).replace(/\.ts$/, ".js");
	}

	public constructor(compiler: Compiler, pkg: Package, sourceFile: ts.SourceFile) {
		this.path = sourceFile.fileName;
		this.package = pkg;
		this.sourceFile = sourceFile;
		this.comptimeDeclarations = this.resolveComptimeItems(compiler);
	}

	public resolveComptimeItems(compiler: Compiler) {
		const copmtimeItems = new Map<string, ComptimeItem>();
		this.sourceFile.statements.forEach(statement => {
			if (ts.isVariableStatement(statement)) {
				const decl = statement.declarationList.declarations[0];
				if (!decl || !ts.isIdentifier(decl.name) || !decl.initializer)
					return;

				const name = decl.name.text;
				const declSymbol = compiler.typeChecker.getSymbolAtLocation(decl.name);
				assert.ok(declSymbol, "Could not get declaration symbol!");

				const parse = (node: ts.Node) => {
					if (ts.isCallExpression(node)) {
						if (ts.isPropertyAccessExpression(node.expression)) {
							const access = node.expression;
							const objectSymbol = compiler.typeChecker.getSymbolAtLocation(access.expression);
							assert.ok(objectSymbol, `Could not get symbol...`);
							if (compiler.getComptimeTypeFromSymbol(objectSymbol) === "comptime") {
								const propertySymbol = compiler.typeChecker.getSymbolAtLocation(access.name);
								assert.ok(propertySymbol, `Could not get symbol...`);
								if (propertySymbol.name === "fn") {
									copmtimeItems.set(name, { name, type: "comptime.fn.decl", symbol: declSymbol, comptimeModulePath: this.comptimePath, isExternal: false });
								} else if (propertySymbol.name === "macro") {
									copmtimeItems.set(name, { name, type: "comptime.macro", symbol: declSymbol, comptimeModulePath: this.comptimePath, isExternal: false });
								}
							}
						} else if (ts.isIdentifier(node.expression)) {
							const s = compiler.typeChecker.getSymbolAtLocation(node.expression);
							assert.ok(s, `Could not get symbol...`);
							const type = compiler.getComptimeTypeFromSymbol(s!);
							if (type === "comptime") {
								copmtimeItems.set(name, { name, type: "comptime", symbol: declSymbol, comptimeModulePath: this.comptimePath, isExternal: false });
							}
						}
					}
				}

				if (ts.isAwaitExpression(decl.initializer)) {
					parse(decl.initializer.expression)
				} else {
					parse(decl.initializer);
				}
			}
		});
		return copmtimeItems;
	}
}
