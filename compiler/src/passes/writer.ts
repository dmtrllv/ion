
import * as ts from "typescript";
import { dirname, relative, resolve, sep } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { Pass } from "./pass.js";
import { Compiler } from "../compiler.js";
import { ComptimeEvaluation } from "./evaluator.js";
import { ModuleMap } from "./resolver.js";

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
	readonly version: number;
	readonly exports: Record<string, {
		readonly kind: string;
		readonly module: string;
		readonly name: string;
		readonly source?: string;
		readonly runtimeModule?: string;
	}>;
};

type PackageInfo = {
	readonly root: string;
	readonly comptimeOutput: string;
	readonly manifest: ComptimeManifest;
};

type MacroSource = {
	readonly sourceFile: ts.SourceFile;
	readonly typeChecker: ts.TypeChecker;
};

export class ComptimeWriter
	implements Pass<void, [ComptimeEvaluation, ModuleMap]> {
	public run(
		compiler: Compiler,
		evaluation: ComptimeEvaluation,
	): void {
		const emitResult = compiler.program.emit(
			undefined,
			undefined,
			undefined,
			false,
			{
				before: [
					this.transformer(
						compiler,
						evaluation,
					),
				],
			},
		);

		if (emitResult.emitSkipped || emitResult.diagnostics.length > 0) {
			const diagnostics = ts.formatDiagnosticsWithColorAndContext(
				emitResult.diagnostics,
				{
					getCurrentDirectory: ts.sys.getCurrentDirectory,
					getCanonicalFileName: fileName => fileName,
					getNewLine: () => ts.sys.newLine,
				},
			);

			throw new RefError(`TypeScript emit failed:\n${diagnostics}`);
		}
	}

	private readonly transformer = (
		compiler: Compiler,
		{ results, comptimeImports, comptimeDeclarations }: ComptimeEvaluation,
	): ts.TransformerFactory<ts.SourceFile> => {
		return context => {
			const isComptimeExport = (
				element: ts.ExportSpecifier,
			): boolean => {
				let symbol = compiler.typeChecker.getSymbolAtLocation(
					element.propertyName ?? element.name,
				);

				if (!symbol) {
					return false;
				}

				while ((symbol.flags & ts.SymbolFlags.Alias) !== 0) {
					const target = compiler.typeChecker.getAliasedSymbol(symbol);

					if (target === symbol) {
						break;
					}

					symbol = target;
				}

				return (symbol.declarations ?? []).some(
					declaration =>
						ts.isVariableDeclaration(declaration) &&
						comptimeDeclarations.has(declaration),
				);
			};

			const visit: ts.Visitor = node => {
				if (ts.isVariableStatement(node)) {
					const declarations = node.declarationList.declarations.filter(
						declaration => !comptimeDeclarations.has(declaration),
					);

					if (declarations.length === 0) {
						return undefined;
					}

					if (
						declarations.length !==
						node.declarationList.declarations.length
					) {
						return ts.factory.updateVariableStatement(
							node,
							node.modifiers,
							ts.factory.updateVariableDeclarationList(
								node.declarationList,
								declarations,
							),
						);
					}
				}

				if (ts.isImportDeclaration(node)) {
					if (
						ts.isStringLiteral(node.moduleSpecifier) &&
						node.moduleSpecifier.text === "@ion/comptime"
					) {
						return undefined;
					}

					const names = comptimeImports.get(node);

					if (names && node.importClause) {
						const clause = node.importClause;

						const defaultName =
							clause.name && !names.has(clause.name.text)
								? clause.name
								: undefined;

						let namedBindings = clause.namedBindings;

						if (
							namedBindings &&
							ts.isNamedImports(namedBindings)
						) {
							const elements = namedBindings.elements.filter(
								element => !names.has(element.name.text),
							);

							namedBindings =
								elements.length > 0
									? ts.factory.updateNamedImports(
										namedBindings,
										elements,
									)
									: undefined;
						}

						if (!defaultName && !namedBindings) {
							return undefined;
						}

						const importClause = ts.factory.updateImportClause(
							clause,
							clause.isTypeOnly,
							defaultName,
							namedBindings,
						);

						return ts.factory.updateImportDeclaration(
							node,
							node.modifiers,
							importClause,
							node.moduleSpecifier,
							node.attributes,
						);
					}
				}

				if (ts.isExportDeclaration(node)) {
					if (
						node.exportClause &&
						ts.isNamedExports(node.exportClause)
					) {
						const elements = node.exportClause.elements.filter(
							element =>
								!node.isTypeOnly &&
								!element.isTypeOnly &&
								!isComptimeExport(element),
						);

						if (elements.length === 0) {
							return undefined;
						}

						if (
							elements.length !== node.exportClause.elements.length
						) {
							return ts.factory.updateExportDeclaration(
								node,
								node.modifiers,
								node.isTypeOnly,
								ts.factory.updateNamedExports(
									node.exportClause,
									elements,
								),
								node.moduleSpecifier,
								node.attributes,
							);
						}
					}
				}

				if (ts.isCallExpression(node)) {
					const result = results.get(node);

					if (result !== undefined) {
						return result;
					}
				}

				return ts.visitEachChild(node, visit, context);
			};

			return sourceFile => {
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

					if (
						!ts.isExpressionStatement(statement) ||
						!ts.isStringLiteral(statement.expression)
					) {
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

			const macroSource = this.getMacroSource(compiler, call);

			if (!macroSource) {
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
							macroSource,
							name,
						);

						if (
							resolve(reference.sourceFile.fileName) !==
							resolve(sourceFile.fileName)
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

		const grouped = new Map<string, ResolvedReference[]>();

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
			const elements = group.map(reference =>
				ts.factory.createImportSpecifier(
					false,
					reference.exportName === reference.localName
						? undefined
						: ts.factory.createIdentifier(reference.exportName),
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
				onUnRecoverableConfigFileDiagnostic: diagnostic => {
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

		const outputRelativePath = sourceRelativePath.replace(
			/\.(tsx?|mts|cts)$/,
			".js",
		);

		return resolve(outDir, outputRelativePath);
	}

	private resolveReference(
		_compiler: Compiler,
		consumer: ts.SourceFile,
		macroSource: MacroSource,
		name: string,
	): ResolvedReference {
		const macroSourceFile = macroSource.sourceFile;
		const typeChecker = macroSource.typeChecker;

		const targetSymbol = this.findReferenceSymbol(
			typeChecker,
			macroSourceFile,
			name,
		);

		const declaration =
			targetSymbol.valueDeclaration ?? targetSymbol.declarations?.[0];

		if (!declaration) {
			throw new RefError(
				`Comptime reference "${name}" has no declaration.`,
			);
		}

		const declarationSourceFile = declaration.getSourceFile();
		const targetPackage = this.findPackageRoot(
			declarationSourceFile.fileName,
		);

		let targetModulePath: string;
		let exported: ts.Symbol;

		if (declarationSourceFile.isDeclarationFile) {
			const declarationRelativePath = relative(
				targetPackage.root,
				resolve(declarationSourceFile.fileName),
			).replace(/\\/g, "/");

			const declarationStem = declarationRelativePath
				.replace(/^types\//, "src/")
				.replace(/\.d\.(?:ts|mts|cts)$/, match => {
					switch (match) {
						case ".d.mts":
							return ".mts";
						case ".d.cts":
							return ".cts";
						default:
							return ".ts";
					}
				});

			const manifestEntry = Object.values(
				targetPackage.manifest.exports,
			).find(entry =>
				entry.source === declarationStem ||
				entry.source === declarationRelativePath,
			);

			if (!manifestEntry?.runtimeModule) {
				throw new RefError(
					`Comptime reference "${name}" resolves to declaration file ` +
					`"${declarationSourceFile.fileName}", but no matching ` +
					`runtimeModule exists in ` +
					`"${targetPackage.root}/comptime.manifest.json".`,
				);
			}

			targetModulePath = resolve(
				targetPackage.root,
				manifestEntry.runtimeModule,
			);

			const moduleSymbol = typeChecker.getSymbolAtLocation(
				declarationSourceFile,
			);

			const matchingExport = moduleSymbol
				? typeChecker.getExportsOfModule(moduleSymbol).find(
					symbol =>
						this.resolveAliasWithChecker(typeChecker, symbol) ===
						targetSymbol,
				)
				: undefined;

			if (!matchingExport) {
				throw new RefError(
					`Comptime reference "${name}" must refer to an exported value. ` +
					`Its declaration is in "${declarationSourceFile.fileName}".`,
				);
			}

			exported = matchingExport;
		} else {
			const moduleSymbol = typeChecker.getSymbolAtLocation(
				declarationSourceFile,
			);

			const matchingExport = moduleSymbol
				? typeChecker.getExportsOfModule(moduleSymbol).find(
					symbol =>
						this.resolveAliasWithChecker(typeChecker, symbol) ===
						targetSymbol,
				)
				: undefined;

			if (!matchingExport) {
				throw new RefError(
					`Comptime reference "${name}" must refer to an exported value. ` +
					`Its declaration is in "${declarationSourceFile.fileName}".`,
				);
			}

			exported = matchingExport;
			targetModulePath = this.getRuntimeOutputModule(
				targetPackage,
				declarationSourceFile,
			);
		}

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
			sourceFile: declarationSourceFile,
			exportName: exported.name,
			localName: name,
			moduleSpecifier,
		};
	}

	private findReferenceSymbol(
		typeChecker: ts.TypeChecker,
		sourceFile: ts.SourceFile,
		name: string,
	): ts.Symbol {
		const symbols = new Set<ts.Symbol>();

		const visit = (node: ts.Node): void => {
			if (
				ts.isCallExpression(node) &&
				ts.isPropertyAccessExpression(node.expression) &&
				node.expression.name.text === "ref" &&
				ts.isPropertyAccessExpression(node.expression.expression) &&
				node.expression.expression.name.text === "syntax" &&
				node.arguments.length > 0 &&
				ts.isIdentifier(node.arguments[0]!) &&
				node.arguments[0]!.text === name
			) {
				const symbol = typeChecker.getSymbolAtLocation(
					node.arguments[0]!,
				);

				if (symbol) {
					symbols.add(
						this.resolveAliasWithChecker(typeChecker, symbol),
					);
				}
			}

			ts.forEachChild(node, visit);
		};

		visit(sourceFile);

		if (symbols.size === 0) {
			throw new RefError(
				`Comptime reference "${name}" could not be resolved in ` +
				`"${sourceFile.fileName}".`,
			);
		}

		if (symbols.size > 1) {
			throw new RefError(
				`Comptime reference "${name}" is ambiguous in ` +
				`"${sourceFile.fileName}": multiple syntax.ref calls ` +
				`refer to different symbols.`,
			);
		}

		return symbols.values().next().value!;
	}

	private getMacroSource(
		compiler: Compiler,
		call: ts.CallExpression,
	): MacroSource | undefined {
		const symbol = compiler.typeChecker.getSymbolAtLocation(
			call.expression,
		);

		if (!symbol) {
			return undefined;
		}

		const target = this.resolveAlias(compiler, symbol);
		const declaration =
			target.valueDeclaration ?? target.declarations?.[0];

		if (!declaration) {
			return undefined;
		}

		const declarationSource = declaration.getSourceFile();
		const pkg = this.findPackageRoot(declarationSource.fileName);

		const entry = Object.values(pkg.manifest.exports).find(
			item => item.name === target.name,
		);

		if (!entry?.source) {
			throw new RefError(
				`Could not find the source file for comptime export ` +
				`"${target.name}" in "${pkg.root}/comptime.manifest.json".`,
			);
		}

		const sourcePath = resolve(pkg.root, entry.source);
		const configPath = ts.findConfigFile(
			pkg.root,
			ts.sys.fileExists,
			"tsconfig.json",
		);

		if (!configPath) {
			throw new RefError(
				`Could not find tsconfig.json for "${pkg.root}".`,
			);
		}

		const config = ts.getParsedCommandLineOfConfigFile(
			configPath,
			{},
			{
				...ts.sys,
				onUnRecoverableConfigFileDiagnostic: diagnostic => {
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

		const program = ts.createProgram({
			rootNames: [
				...new Set([...config.fileNames, sourcePath]),
			],
			options: config.options,
		});

		const sourceFile = program.getSourceFile(sourcePath);

		if (!sourceFile) {
			throw new RefError(
				`Could not load comptime source "${sourcePath}".`,
			);
		}

		return {
			sourceFile,
			typeChecker: program.getTypeChecker(),
		};
	}

	private resolveAlias(
		compiler: Compiler,
		symbol: ts.Symbol,
	): ts.Symbol {
		let current = symbol;

		while ((current.flags & ts.SymbolFlags.Alias) !== 0) {
			const target = compiler.typeChecker.getAliasedSymbol(current);

			if (target === current) {
				break;
			}

			current = target;
		}

		return current;
	}

	private resolveAliasWithChecker(
		typeChecker: ts.TypeChecker,
		symbol: ts.Symbol,
	): ts.Symbol {
		let current = symbol;

		while ((current.flags & ts.SymbolFlags.Alias) !== 0) {
			const target = typeChecker.getAliasedSymbol(current);

			if (target === current) {
				break;
			}

			current = target;
		}

		return current;
	}

	private findTopLevelSymbol(
		compiler: Compiler,
		sourceFile: ts.SourceFile,
		name: string,
	): ts.Symbol | undefined {
		const moduleSymbol = compiler.typeChecker.getSymbolAtLocation(
			sourceFile,
		);

		if (moduleSymbol) {
			const exported = compiler.typeChecker
				.getExportsOfModule(moduleSymbol)
				.find(symbol => symbol.name === name);

			if (exported) {
				return exported;
			}
		}

		for (const statement of sourceFile.statements) {
			if (
				ts.isImportDeclaration(statement) &&
				statement.importClause
			) {
				const clause = statement.importClause;

				if (clause.name?.text === name) {
					return compiler.typeChecker.getSymbolAtLocation(
						clause.name,
					);
				}

				if (clause.namedBindings) {
					if (ts.isNamespaceImport(clause.namedBindings)) {
						if (clause.namedBindings.name.text === name) {
							return compiler.typeChecker.getSymbolAtLocation(
								clause.namedBindings.name,
							);
						}
					} else {
						for (const element of clause.namedBindings.elements) {
							if (element.name.text === name) {
								return compiler.typeChecker.getSymbolAtLocation(
									element.name,
								);
							}
						}
					}
				}
			}

			if (
				ts.isVariableStatement(statement) &&
				statement.declarationList.declarations.some(declaration =>
					this.bindingContainsName(declaration.name, name),
				)
			) {
				return this.findDeclarationSymbol(
					compiler,
					statement.declarationList.declarations,
					name,
				);
			}

			if (
				(ts.isFunctionDeclaration(statement) ||
					ts.isClassDeclaration(statement) ||
					ts.isInterfaceDeclaration(statement) ||
					ts.isTypeAliasDeclaration(statement) ||
					ts.isEnumDeclaration(statement)) &&
				statement.name?.text === name
			) {
				return compiler.typeChecker.getSymbolAtLocation(
					statement.name,
				);
			}
		}

		return undefined;
	}

	private bindingContainsName(
		name: ts.BindingName,
		target: string,
	): boolean {
		if (ts.isIdentifier(name)) {
			return name.text === target;
		}

		return name.elements.some(element =>
			ts.isOmittedExpression(element)
				? false
				: this.bindingContainsName(element.name, target),
		);
	}

	private findDeclarationSymbol(
		compiler: Compiler,
		declarations: readonly ts.VariableDeclaration[],
		name: string,
	): ts.Symbol | undefined {
		for (const declaration of declarations) {
			const symbol = this.findBindingSymbol(
				compiler,
				declaration.name,
				name,
			);

			if (symbol) {
				return symbol;
			}
		}

		return undefined;
	}

	private findBindingSymbol(
		compiler: Compiler,
		binding: ts.BindingName,
		name: string,
	): ts.Symbol | undefined {
		if (ts.isIdentifier(binding)) {
			return binding.text === name
				? compiler.typeChecker.getSymbolAtLocation(binding)
				: undefined;
		}

		for (const element of binding.elements) {
			if (ts.isOmittedExpression(element)) {
				continue;
			}

			const symbol = this.findBindingSymbol(
				compiler,
				element.name,
				name,
			);

			if (symbol) {
				return symbol;
			}
		}

		return undefined;
	}

	private hasImport(
		sourceFile: ts.SourceFile,
		moduleSpecifier: string,
		exportName: string,
		localName: string,
	): boolean {
		return sourceFile.statements.some(statement => {
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
				element =>
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
	): string {
		return this.getOutputModulePath(pkg, sourceFile);
	}
}

export class RefError extends Error {
	public constructor(error: string) {
		super(error);
	}
}
