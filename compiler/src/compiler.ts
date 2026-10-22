import { dirname, join, resolve } from "node:path";
import { API, ParsedCommandLine, Program } from "typescript/async";
import { asyncDisposable } from "./disposable.js";
import { AstTree } from "./ast/tree.js";
import { Package } from "./package.js";
import { Module } from "./ast/module.js";
import { existsSync } from "node:fs";
import { VariableStatement } from "./ast/var.js";

export class Compiler {
	public static readonly load = async (root: string) => {
		const api = new API();
		const pkg = await Package.load(api, root);
		const config = await api.parseConfigFile(resolve(root, "tsconfig.json"));
		const program = await api.createProgram(config.fileNames, config.options, {});
		return asyncDisposable(new Compiler(api, pkg, config, program));
	}

	public readonly root: Package;
	public readonly config: ParsedCommandLine;
	public readonly api: API<false>;
	public readonly program: Program<import("typescript/async").ProjectId>;
	public readonly ast: AstTree;
	public readonly packages: Map<string, Promise<Package>>;

	private constructor(api: API, rootPackage: Package, config: ParsedCommandLine, program: Program) {
		this.api = api;
		this.root = rootPackage;
		this.config = config;
		this.program = program;
		this.ast = new AstTree(this);
		this.packages = new Map<string, Promise<Package>>();
		this.packages.set(rootPackage.path, Promise.resolve(rootPackage));
	}

	public async resolvePackage(path: string) {
		if (this.packages.has(path))
			return this.packages.get(path)!;
		const pkg = Package.load(this.api, path);
		this.packages.set(path, pkg);
		return pkg;
	}

	public async resolvePackageFromModule(module: Module) {
		let packageRoot = dirname(module.path);
		while (!existsSync(join(packageRoot, "package.json"))) {
			const parent = dirname(packageRoot);
			if (parent === packageRoot) {
				return undefined;
			}
			packageRoot = parent;
		}
		return this.resolvePackage(packageRoot);
	}

	public async compile() {
		for (const path of this.root.sourceFilePaths) {
			const module = await this.ast.resolveModule(path);
			console.log(module.path);
			for(const stmt of module.statements) {
				if(stmt.is(VariableStatement)) {
					console.log(stmt.variables.map(v => v.name))
				}
			}
			console.log();
		}
	}
}

//const reportErrors = (diagnostics: readonly Diagnostic[]) => {
//    console.log(formatDiagnosticsWithColorAndContext(diagnostics, api))
//};

//// Parse command-line filenames and compiler options, report any errors.
//const commandLineArgs = process.argv.slice(2);
//const parsedCommandLine = api.parseCommandLine(commandLineArgs);
//if (parsedCommandLine.errors.length > 0) {
//    reportErrors(parsedCommandLine.errors);
//    process.exit();
//}

//const config = api.parseJsonConfigFileContent("", { configDirectory: "" });
//config.options
//// Create the program by resolving and parsing all files in the entry point.
//using program = api.createProgram(parsedCommandLine.fileNames, parsedCommandLine.options);
//using program2 = api.createProgram()
//// Collect and report any diagnostics from the program before emitting.
//// You can customize whether any of these block reporting errors in subsequent passes if desired.
//const diagnostics = [
//    ...program.getGlobalDiagnostics(),
//    ...program.getProgramDiagnostics(),
//    ...program.getSyntacticDiagnostics(),
//    ...program.getSemanticDiagnostics(),
//];
//if (diagnostics.length > 0) {
//    reportErrors(diagnostics);
//}

//// Emit files - this respects the `noEmitOnError` option,
//// so nothing will be emitted if an earlier step reported errors.
//const emitResult = program.emit();
//if (emitResult.diagnostics.length > 0) {
//    reportErrors(emitResult.diagnostics);
//}