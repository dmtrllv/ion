
import * as ts from "typescript";
import { Compiler } from "../compiler.js";
import { MacroDeclaration, MacroType, Module } from "../module.js";
import { Pass } from "./pass.js";

export class ModuleResolver implements Pass<ModuleMap> {
	public async run(compiler: Compiler): Promise<ModuleMap> {
		const typeChecker = compiler.typeChecker;
		const compilerOptions = compiler.options;
		const modules: ModuleMap = {};

		for (const path of compiler.sourcePaths) {
			const source = compiler.getSource(path);
			const relativePath = compiler.relativePath(path);

			modules[path] = this.resolve(
				typeChecker,
				compilerOptions,
				relativePath,
				source
			);
		}

		this.linkModules(modules, compilerOptions);

		return modules;
	}

	private linkModules(
		modules: ModuleMap,
		compilerOptions: ts.CompilerOptions
	): void {
		for (const module of Object.values(modules)) {
			for (const imp of module.imports) {
				if (imp.path === "@ion/comptime") {
					continue;
				}

				imp.module = modules[imp.absolutePath];
			}

			for (const reExport of module.reExports) {
				const result = ts.resolveModuleName(
					reExport.path,
					module.sourceFile.fileName,
					compilerOptions,
					ts.sys
				);

				const absolutePath = result.resolvedModule?.resolvedFileName;

				if (absolutePath) {
					reExport.module = modules[absolutePath];
				}
			}
		}
	}

	public resolve(
		typeChecker: ts.TypeChecker,
		compilerOptions: ts.CompilerOptions,
		relativePath: string,
		source: ts.SourceFile
	): Module {
		const { imports, namespaces, macroNamespaces } =
			this.resolveImports(source);

		const macroDeclarations: MacroDeclaration[] = [];
		const removeStatements: ts.Node[] = [];

		for (const statement of source.statements) {
			if (ts.isVariableStatement(statement)) {
				for (const declaration of statement.declarationList.declarations) {
					if (
						ts.isIdentifier(declaration.name) &&
						declaration.initializer &&
						ts.isCallExpression(declaration.initializer)
					) {
						const type = this.resolveMacroType(
							declaration.initializer.expression,
							imports,
							namespaces,
							macroNamespaces
						);

						if (type) {
							macroDeclarations.push({
								type,
								statement: declaration
							});
							continue;
						}
					}

					if (this.shouldRemoveExpression(declaration.initializer)) {
						removeStatements.push(declaration);
					}
				}

				continue;
			}

			if (this.shouldRemoveStatement(statement)) {
				removeStatements.push(statement);
			}
		}

		return new Module(
			typeChecker,
			relativePath,
			source,
			removeStatements,
			macroDeclarations,
			compilerOptions
		);
	}

	private shouldRemoveExpression(
		expression: ts.Expression | undefined
	): boolean {
		if (!expression) {
			return false;
		}

		let shouldRemove = false;

		const visit = (node: ts.Node): void => {
			if (shouldRemove) {
				return;
			}

			if (
				ts.isCallExpression(node) ||
				ts.isPropertyAccessExpression(node)
			) {
				shouldRemove = true;
				return;
			}

			node.forEachChild(visit);
		};

		visit(expression);
		return shouldRemove;
	}

	private shouldRemoveStatement(statement: ts.Statement): boolean {
		if (
			ts.isImportDeclaration(statement) ||
			ts.isImportEqualsDeclaration(statement) ||
			ts.isFunctionDeclaration(statement) ||
			ts.isClassDeclaration(statement) ||
			ts.isInterfaceDeclaration(statement) ||
			ts.isTypeAliasDeclaration(statement) ||
			ts.isModuleDeclaration(statement)
		) {
			return false;
		}

		let shouldRemove = false;

		const visit = (node: ts.Node): void => {
			if (shouldRemove) {
				return;
			}

			if (
				ts.isCallExpression(node) ||
				ts.isPropertyAccessExpression(node)
			) {
				shouldRemove = true;
				return;
			}

			node.forEachChild(visit);
		};

		visit(statement);
		return shouldRemove;
	}

	private resolveImports(source: ts.SourceFile): {
		imports: Map<string, MacroType>;
		namespaces: Set<string>;
		macroNamespaces: Set<string>;
	} {
		const imports = new Map<string, MacroType>();
		const namespaces = new Set<string>();
		const macroNamespaces = new Set<string>();

		for (const statement of source.statements) {
			if (
				!ts.isImportDeclaration(statement) ||
				!ts.isStringLiteral(statement.moduleSpecifier) ||
				statement.moduleSpecifier.text !== "@ion/comptime"
			) {
				continue;
			}

			const clause = statement.importClause;

			if (!clause) {
				continue;
			}

			const bindings = clause.namedBindings;

			if (clause.name) {
				imports.set(clause.name.text, "comptime");
			}

			if (!bindings) {
				continue;
			}

			if (ts.isNamespaceImport(bindings)) {
				namespaces.add(bindings.name.text);
				continue;
			}

			if (!ts.isNamedImports(bindings)) {
				continue;
			}

			for (const element of bindings.elements) {
				const importedName =
					element.propertyName?.text ?? element.name.text;

				switch (importedName) {
					case "comptime":
						imports.set(element.name.text, "comptime");
						break;
					case "generate":
						imports.set(element.name.text, "macro.generate");
						break;
					case "attribute":
						imports.set(element.name.text, "macro.attribute");
						break;
					case "fn":
						imports.set(element.name.text, "comptime.fn");
						break;
					case "macro":
						macroNamespaces.add(element.name.text);
						break;
				}
			}
		}

		return {
			imports,
			namespaces,
			macroNamespaces
		};
	}

	private resolveMacroType(
		expression: ts.Node,
		imports: Map<string, MacroType>,
		namespaces: Set<string>,
		macroNamespaces: Set<string>
	): MacroType | undefined {
		if (ts.isIdentifier(expression)) {
			return imports.get(expression.text);
		}

		if (
			!ts.isPropertyAccessExpression(expression) ||
			!ts.isIdentifier(expression.expression)
		) {
			return undefined;
		}

		const namespace = expression.expression.text;
		const property = expression.name.text;

		if (
			!namespaces.has(namespace) &&
			!macroNamespaces.has(namespace)
		) {
			return undefined;
		}

		switch (property) {
			case "comptime":
				return "comptime";
			case "generate":
				return "macro.generate";
			case "attribute":
				return "macro.attribute";
			case "fn":
				return "comptime.fn";
			default:
				return undefined;
		}
	}
}

export type ModuleMap = Record<string, Module>;
