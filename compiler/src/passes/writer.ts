import * as ts from "typescript";
import { dirname, relative, resolve, sep } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { Pass } from "./pass.js";
import { Compiler } from "../compiler.js";

type ComptimeReference = ts.Identifier & {
	readonly __ion_comptime_ref__?: string;
};

type ResolvedReference = {
	readonly sourceFile: ts.SourceFile;
	readonly exportName: string;
	readonly localName: string;
	readonly moduleSpecifier: string;
};

type ComptimeManifest = {
	readonly version: 1;
	readonly exports: Record<string, {
		readonly kind: string;
		readonly module: string;
		readonly name: string;
		readonly source?: string;
	}>;
};

type PackageInfo = {
	readonly root: string;
	readonly comptimeOutput: string;
	readonly manifest: ComptimeManifest;
};

export class ComptimeWriter implements Pass<void, [Map<ts.CallExpression, ts.Expression>]> {
	public run(compiler: Compiler, results: Map<ts.CallExpression, ts.Expression>,): void {
		const emitResult = compiler.program.emit(undefined, undefined, undefined, false, { before: [this.transformer(compiler, results)] });

		if (emitResult.emitSkipped || emitResult.diagnostics.length > 0) {
			const diagnostics = ts.formatDiagnosticsWithColorAndContext(emitResult.diagnostics, {
				getCurrentDirectory: ts.sys.getCurrentDirectory,
				getCanonicalFileName: (fileName) => fileName,
				getNewLine: () => ts.sys.newLine,
			});

			throw new RefError(`TypeScript emit failed:\n${diagnostics}`);
		}
	}

	private readonly transformer = (compiler: Compiler, results: Map<ts.CallExpression, ts.Expression>): ts.TransformerFactory<ts.SourceFile> => {
		return (context) => {
			const visit: ts.Visitor = (node) => {
				if (ts.isCallExpression(node)) {
					const result = results.get(node);

					if (result !== undefined) {
						return result;
					}
				}

				return ts.visitEachChild(node, visit, context);
			};

			return (sourceFile) => {
				const imports = this.createReferenceImports(
					compiler,
					sourceFile,
					results,
				);

				const transformed = ts.visitNode(
					sourceFile,
					visit,
				) as ts.SourceFile;

				if (imports.length === 0) {
					return transformed;
				}

				const statements = [...transformed.statements];
				let index = 0;

				// Preserve the directive prologue.
				while (index < statements.length) {
					const statement = statements[index]!;

					if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) {
						break;
					}

					index++;
				}

				statements.splice(index, 0, ...imports);

				return ts.factory.updateSourceFile(
					transformed,
					statements,
				);
			};
		};
	};

	private createReferenceImports(
		compiler: Compiler,
		sourceFile: ts.SourceFile,
		results: Map<ts.CallExpression, ts.Expression>,
	): ts.ImportDeclaration[] {
		const references = new Map<string, ResolvedReference>();

		for (const [call, expression] of results) {
			if (call.getSourceFile().fileName !== sourceFile.fileName) {
				continue;
			}

			const macroSourceFile = this.getDeclarationSourceFile(
				compiler,
				call,
			);

			if (!macroSourceFile) {
				continue;
			}

			const visit = (node: ts.Node): void => {
				if (ts.isIdentifier(node)) {
					const name = (node as ComptimeReference)
						.__ion_comptime_ref__;

					if (name) {
						const reference = this.resolveReference(
							compiler,
							sourceFile,
							macroSourceFile,
							name,
						);

						if (
							reference.sourceFile.fileName !==
							sourceFile.fileName
						) {
							const key = [
								reference.moduleSpecifier,
								reference.exportName,
								reference.localName,
							].join("\0");

							references.set(key, reference);
						}
					}
				}

				ts.forEachChild(node, visit);
			};

			visit(expression);
		}

		const grouped = new Map<
			string,
			ResolvedReference[]
		>();

		for (const reference of references.values()) {
			if (
				this.hasImport(
					sourceFile,
					reference.moduleSpecifier,
					reference.exportName,
					reference.localName,
				)
			) {
				continue;
			}

			const existing = this.findTopLevelSymbol(
				compiler,
				sourceFile,
				reference.localName,
			);

			if (existing) {
				throw new RefError(
					`Cannot inject comptime reference "${reference.localName}" into ` +
					`"${sourceFile.fileName}": that name is already declared. ` +
					"Rename the conflicting declaration.",
				);
			}

			const group =
				grouped.get(reference.moduleSpecifier) ?? [];

			group.push(reference);
			grouped.set(reference.moduleSpecifier, group);
		}

		const imports: ts.ImportDeclaration[] = [];

		for (const [moduleSpecifier, group] of grouped) {
			const elements = group.map((reference) =>
				ts.factory.createImportSpecifier(
					false,
					reference.exportName === reference.localName
						? undefined
						: ts.factory.createIdentifier(
							reference.exportName,
						),
					ts.factory.createIdentifier(reference.localName),
				),
			);

			imports.push(
				ts.factory.createImportDeclaration(
					undefined,
					ts.factory.createImportClause(
						false,
						undefined,
						ts.factory.createNamedImports(elements),
					),
					ts.factory.createStringLiteral(moduleSpecifier),
					undefined,
				),
			);
		}

		return imports;
	}

	private getOutputModulePath(
		pkg: PackageInfo,
		sourceFile: ts.SourceFile,
	): string {
		const configPath = ts.findConfigFile(
			pkg.root,
			ts.sys.fileExists,
			"tsconfig.json",
		);

		if (!configPath) {
			throw new RefError(
				`Could not find tsconfig.json for package "${pkg.root}".`,
			);
		}

		const config = ts.getParsedCommandLineOfConfigFile(
			configPath,
			{},
			{
				...ts.sys,
				onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
					throw new RefError(
						ts.flattenDiagnosticMessageText(
							diagnostic.messageText,
							ts.sys.newLine,
						),
					);
				},
			},
		);

		if (!config) {
			throw new RefError(`Could not parse "${configPath}".`);
		}

		const rootDir = resolve(
			pkg.root,
			config.options.rootDir ?? ".",
		);

		const outDir = resolve(
			pkg.root,
			config.options.outDir ?? "dist",
		);

		const sourceRelativePath = relative(
			rootDir,
			resolve(sourceFile.fileName),
		);

		if (
			sourceRelativePath === ".." ||
			sourceRelativePath.startsWith(`..${sep}`)
		) {
			throw new RefError(
				`Source "${sourceFile.fileName}" is outside rootDir "${rootDir}".`,
			);
		}

		return resolve(
			outDir,
			sourceRelativePath.replace(/\.(tsx?|mts|cts)$/, ".js"),
		);
	}


	private resolveReference(
		compiler: Compiler,
		consumer: ts.SourceFile,
		macroSourceFile: ts.SourceFile,
		name: string,
	): ResolvedReference {
		const localSymbol = this.findTopLevelSymbol(
			compiler,
			macroSourceFile,
			name,
		);

		if (!localSymbol) {
			throw new RefError(
				`Comptime reference "${name}" could not be resolved in ` +
				`"${macroSourceFile.fileName}".`,
			);
		}

		const targetSymbol = this.resolveAlias(compiler, localSymbol);
		const declaration =
			targetSymbol.valueDeclaration ?? targetSymbol.declarations?.[0];

		if (!declaration) {
			throw new RefError(
				`Comptime reference "${name}" has no declaration.`,
			);
		}

		let targetSourceFile = declaration.getSourceFile();
		let resolvedSymbol = targetSymbol;

		if (targetSourceFile.isDeclarationFile) {
			const targetPackage = this.findPackageRoot(
				targetSourceFile.fileName,
			);

			const manifestEntry = Object.values(
				targetPackage.manifest.exports,
			).find(
				entry => entry.name === targetSymbol.getName(),
			);

			if (!manifestEntry?.source) {
				throw new RefError(
					`Comptime reference "${name}" resolves to a declaration file ` +
					`("${targetSourceFile.fileName}"), but no matching source entry ` +
					`exists in "${targetPackage.root}/comptime.manifest.json".`,
				);
			}

			const sourcePath = resolve(
				targetPackage.root,
				manifestEntry.source,
			);

			const sourceFile = compiler.program.getSourceFile(sourcePath);

			if (!sourceFile || sourceFile.isDeclarationFile) {
				throw new RefError(
					`Could not resolve the runtime source for comptime reference ` +
					`"${name}" from "${sourcePath}". Ensure that the source file ` +
					`is included in the compiler program.`,
				);
			}

			targetSourceFile = sourceFile;

			const sourceModuleSymbol =
				compiler.typeChecker.getSymbolAtLocation(targetSourceFile);

			const sourceExport = sourceModuleSymbol
				? compiler.typeChecker
					.getExportsOfModule(sourceModuleSymbol)
					.find(symbol =>
						symbol.getName() === manifestEntry.name,
					)
				: undefined;

			if (!sourceExport) {
				throw new RefError(
					`Manifest entry "${manifestEntry.name}" is not exported by ` +
					`"${targetSourceFile.fileName}".`,
				);
			}

			resolvedSymbol = this.resolveAlias(compiler, sourceExport);
		}

		const moduleSymbol = compiler.typeChecker.getSymbolAtLocation(
			targetSourceFile,
		);

		const exported = moduleSymbol
			? compiler.typeChecker.getExportsOfModule(moduleSymbol).find(
				symbol =>
					this.resolveAlias(compiler, symbol) === resolvedSymbol,
			)
			: undefined;

		if (!exported) {
			throw new RefError(
				`Comptime reference "${name}" must refer to an exported value. ` +
				`Its declaration is in "${targetSourceFile.fileName}".`,
			);
		}

		const targetPackage = this.findPackageRoot(
			targetSourceFile.fileName,
		);

		const targetModulePath = this.getRuntimeOutputModule(
			targetPackage,
			targetSourceFile,
			resolvedSymbol,
		);

		const consumerPackage = this.findPackageRoot(consumer.fileName);

		const consumerOutputPath = this.getOutputModulePath(
			consumerPackage,
			consumer,
		);

		let moduleSpecifier = relative(
			dirname(consumerOutputPath),
			targetModulePath,
		).replace(/\\/g, "/");

		if (!moduleSpecifier.startsWith(".")) {
			moduleSpecifier = `./${moduleSpecifier}`;
		}

		return {
			sourceFile: targetSourceFile,
			exportName: exported.name,
			localName: name,
			moduleSpecifier,
		};
	}


	private getDeclarationSourceFile(
		compiler: Compiler,
		call: ts.CallExpression,
	): ts.SourceFile | undefined {
		const symbol = compiler.typeChecker.getSymbolAtLocation(
			call.expression,
		);

		if (!symbol) {
			return undefined;
		}

		const target = this.resolveAlias(compiler, symbol);
		const declaration = target.valueDeclaration ??
			target.declarations?.[0];

		return declaration?.getSourceFile();
	}

	private findTopLevelSymbol(
		compiler: Compiler,
		sourceFile: ts.SourceFile,
		name: string,
	): ts.Symbol | undefined {
		const find = (identifier: ts.Identifier) =>
			identifier.text === name
				? compiler.typeChecker.getSymbolAtLocation(identifier)
				: undefined;

		for (const statement of sourceFile.statements) {
			if (ts.isVariableStatement(statement)) {
				for (const declaration of statement.declarationList.declarations) {
					if (ts.isIdentifier(declaration.name)) {
						const symbol = find(declaration.name);
						if (symbol) return symbol;
					}
				}
			}

			if (
				(ts.isFunctionDeclaration(statement) ||
					ts.isClassDeclaration(statement) ||
					ts.isEnumDeclaration(statement)) &&
				statement.name?.text === name
			) {
				const symbol = find(statement.name);
				if (symbol) return symbol;
			}

			if (ts.isImportDeclaration(statement)) {
				const clause = statement.importClause;

				if (!clause) continue;

				if (clause.name?.text === name) {
					const symbol = find(clause.name);
					if (symbol) return symbol;
				}

				const bindings = clause.namedBindings;

				if (bindings && ts.isNamespaceImport(bindings)) {
					if (bindings.name.text === name) {
						const symbol = find(bindings.name);
						if (symbol) return symbol;
					}
				}

				if (bindings && ts.isNamedImports(bindings)) {
					for (const element of bindings.elements) {
						if (element.name.text === name) {
							const symbol = find(element.name);
							if (symbol) return symbol;
						}
					}
				}
			}
		}

		return undefined;
	}

	private resolveAlias(
		compiler: Compiler,
		symbol: ts.Symbol,
	): ts.Symbol {
		let current = symbol;

		while ((current.flags & ts.SymbolFlags.Alias) !== 0) {
			const target = compiler.typeChecker.getAliasedSymbol(current);

			if (target === current) break;
			current = target;
		}

		return current;
	}

	private hasImport(
		sourceFile: ts.SourceFile,
		moduleSpecifier: string,
		exportName: string,
		localName: string,
	): boolean {
		return sourceFile.statements.some((statement) => {
			if (
				!ts.isImportDeclaration(statement) ||
				!ts.isStringLiteral(statement.moduleSpecifier) ||
				statement.moduleSpecifier.text !== moduleSpecifier
			) {
				return false;
			}

			const bindings = statement.importClause?.namedBindings;

			if (!bindings || !ts.isNamedImports(bindings)) {
				return false;
			}

			return bindings.elements.some(
				(element) =>
					element.name.text === localName &&
					(element.propertyName?.text ?? element.name.text) ===
					exportName,
			);
		});
	}


	private findPackageRoot(sourcePath: string): PackageInfo {
		let directory = dirname(sourcePath);

		while (true) {
			const packagePath = resolve(directory, "package.json");

			try {
				const packageJson = JSON.parse(
					readFileSync(packagePath, "utf-8"),
				);

				const manifestPath = resolve(
					directory,
					"comptime.manifest.json",
				);

				let manifest: ComptimeManifest = {
					version: 1,
					exports: {},
				};

				if (existsSync(manifestPath)) {
					manifest = JSON.parse(
						readFileSync(manifestPath, "utf-8"),
					) as ComptimeManifest;
				}

				return {
					root: directory,
					comptimeOutput: resolve(
						directory,
						packageJson?.ion?.comptime?.output ?? "./comptime",
					),
					manifest,
				};
			} catch (error) {
				if (
					!(error instanceof Error) ||
					!("code" in error) ||
					(error.code !== "ENOENT" && error.code !== "ENOTDIR")
				) {
					throw error;
				}
			}

			const parent = dirname(directory);

			if (parent === directory) {
				throw new RefError(
					`Could not find package.json for "${sourcePath}".`,
				);
			}

			directory = parent;
		}
	}

	private getRuntimeOutputModule(
		pkg: PackageInfo,
		sourceFile: ts.SourceFile,
		// @ts-expect-error
		targetSymbol: ts.Symbol,
	): string {
		return this.getOutputModulePath(pkg, sourceFile);
	}
}

export class RefError extends Error {
	public constructor(error: string) {
		super(error)
	}
}