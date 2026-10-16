import * as ts from "typescript";

export class Module {
	public readonly path: string;
	public readonly sourceFile: ts.SourceFile;
	public readonly usesComptime: boolean;
	public readonly macroDeclarations!: MacroDeclaration[];
	public readonly removeStatements!: ts.Node[];
	public readonly imports!: Import[];

	public constructor(typeChecker: ts.TypeChecker, relativePath: string, sourceFile: ts.SourceFile, removeStatements: ts.Node[], macroDeclarations: MacroDeclaration[], compilerOptions: ts.CompilerOptions) {
		this.path = relativePath;
		this.sourceFile = sourceFile;
		this.usesComptime = macroDeclarations.length !== 0;
		this.macroDeclarations = macroDeclarations;
		this.removeStatements = removeStatements;
		this.imports = this.resolveImports(typeChecker, compilerOptions);
		this.resolveExports(typeChecker);
	}

	private resolveImports(typeChecker: ts.TypeChecker, compilerOptions: ts.CompilerOptions): Import[] {
		const imports: Import[] = [];

		for (const node of this.sourceFile.statements) {
			if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier))
				continue;

			const clause = node.importClause;
			const symbols: Record<string, ts.Symbol> = {};

			if (clause) {
				if (clause.name) {
					const symbol = typeChecker.getSymbolAtLocation(clause.name);
					if (symbol) symbols["default"] = symbol;
				}

				const bindings = clause.namedBindings;

				if (bindings && ts.isNamespaceImport(bindings)) {
					const symbol = typeChecker.getSymbolAtLocation(bindings.name);
					if (symbol) symbols["*"] = symbol;
				} else if (bindings && ts.isNamedImports(bindings)) {
					for (const element of bindings.elements) {
						const symbol = typeChecker.getSymbolAtLocation(element.name);
						if (symbol) symbols[element.propertyName?.text ?? element.name.text] = symbol;
					}
				}
			}

			const result = ts.resolveModuleName(
				node.moduleSpecifier.text,
				this.sourceFile.fileName,
				compilerOptions,
				ts.sys
			);

			const absolutePath = result.resolvedModule?.resolvedFileName;

			if (!absolutePath)
				throw new Error(`Could not get absolute path for import!`);

			imports.push({
				absolutePath: absolutePath,
				path: node.moduleSpecifier.text,
				node,
				symbols,
			});
		}

		return imports;
	}

	private resolveExports(checker: ts.TypeChecker) {
		const moduleSymbol = checker.getSymbolAtLocation(this.sourceFile);

		if (moduleSymbol) {
			for (const symbol of checker.getExportsOfModule(moduleSymbol)) {
				const type = checker.getTypeOfSymbolAtLocation(
					symbol,
					symbol.valueDeclaration ?? this.sourceFile,
				);

				console.log(symbol.name, checker.typeToString(type));
			}
		}
	}

	public get fullPath(): string {
		return this.sourceFile.fileName;
	}
}

export type MacroDeclaration = {
	readonly type: MacroType;
	readonly statement: ts.VariableDeclaration;
};

export type MacroType =
	| "comptime"
	| "comptime.fn"
	| "macro.generate"
	| "macro.attribute";

export type Import = {
	absolutePath: string;
	path: string;
	node: ts.Node;
	symbols: Record<string, ts.Symbol>;
	module?: Module | undefined;
};