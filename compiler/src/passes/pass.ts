import { Compiler } from "../compiler.js";

export interface Pass<T, Inputs extends any[] = []> {
	run(compiler: Compiler, ...inputs: Inputs): Promise<T>;
}