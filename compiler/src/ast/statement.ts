import { Variable } from "./var.js";
import { Function } from "./function.js";
import { Expression } from "./expression.js";
import { Class } from "./class.js";
import { Macro } from "./macro.js";
import { Import } from "./import.js";

export type Statement =
	| Macro
	| Variable
	| Function
	| Class
	| Import
	| Expression;

export interface Exportable {
	get isExported(): boolean;
}

export const isExportable = <T extends Statement>(statement: T): statement is Exportable & T => {
	return "isExported" in statement;
};

export const isExported = (statement: Statement) => {
	if (isExportable(statement))
		return statement.isExported;
	return false;	
};