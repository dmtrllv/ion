import { Compiler } from "../compiler.js";
import { Pass } from "./pass.js";
import { TransformedModule } from "./transformer.js";

export class ComptimeEvaluator implements Pass<any, [TransformedModule[]]> {
	async run(compiler: Compiler, transformedModules: TransformedModule[]) {
		await Promise.all(transformedModules.map(module => this.evaluate(compiler, module, transformedModules)))
	}

	private async evaluate(compiler: Compiler, transformedModule: TransformedModule, transformedModules: TransformedModule[]) {
		// find comptime calls
		const comptimeModulePaths = transformedModules.map(i => i.original.usesComptime ? i.path : null).filter(s =>!!s);
		
		//transformedModule.original.imports.map(i => {
		//	//if(comptimeModulePaths)
		//	if(i.absolutePath === "@ion/comptime") {
		//		//console.log("handle @ion/comptime calls");
		//	} else 
		//	console.log(comptimeModulePaths, i.absolutePath);
		//})
	}
}