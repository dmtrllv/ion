import ts from "typescript";
import { Package } from "./package.js";

export class Compiler {
	public readonly root: Package;
	public readonly config: ts.ParsedCommandLine;
	public readonly program: ts.Program;

	public constructor(root: Package) {
		this.root = root;
		this.config = root.tsconfig;
		this.program = ts.createIncrementalProgram<ts.BuilderProgram>({
			rootNames: this.config.fileNames,
			options: this.config.options
		}).getProgram();
	}
}