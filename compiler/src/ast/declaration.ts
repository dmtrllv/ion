import { Class } from "./class.js";
import { Macro } from "./macro.js";
import { Variable } from "./var.js";

export type Declaration = 
	| Variable
	| Function
	| Macro
	| Class;