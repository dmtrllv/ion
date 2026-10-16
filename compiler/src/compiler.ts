import { resolve, sep } from "node:path";
import * as ts from "typescript";
import { Pass } from "./passes/pass.js";

export class Compiler {
	public static run = async <T>(root: string, callback: (compiler: Compiler) => T): Promise<Awaited<T>> => {
		const configPath = resolve(root, "tsconfig.json");
		const configFile = ts.readConfigFile(configPath, ts.sys.readFile);

		if (configFile.error) {
			throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
		}

		const config = ts.parseJsonConfigFileContent(
			configFile.config,
			ts.sys,
			root,
			undefined,
			configPath
		);

		if (config.errors.length > 0) {
			throw new Error(
				config.errors
					.map(error => ts.flattenDiagnosticMessageText(error.messageText, "\n"))
					.join("\n")
			);
		}

		const compiler = new Compiler(root, config);

		return await callback(compiler);
	};

	public readonly sourceRoot: string;
	public readonly root: string;

	readonly #config: ts.ParsedCommandLine;
	readonly #program: ts.Program;

	public get typeChecker() {
		return this.#program.getTypeChecker();
	}

	public get options() {
		return this.#program.getCompilerOptions();
	}

	private constructor(root: string, config: ts.ParsedCommandLine) {
		this.root = root;
		this.sourceRoot = config.options.rootDir ?? root;
		this.#config = config;
		this.#program = ts.createProgram({
			rootNames: config.fileNames,
			options: config.options
		});
	}

	public async run<T, Inputs extends any[] = []>(pass: new () => Pass<T, Inputs>, ...inputs: Inputs): Promise<T> {
		return new pass().run(this, ...inputs);
	}

	public readonly relativePath = (path: string) => path.replace(this.sourceRoot + sep, "");

	public get sourcePaths(): string[] {
		return this.#config.fileNames;
	}

	public getSource(path: string) {
		const source = this.#program.getSourceFile(path);

		if (source === undefined) {
			throw new Error(`Could not get source file for ${path}!`);
		}

		return source;
	}
}