import { Variable } from "./var.js";
import { Function } from "./function.js";
import { Expression } from "./expression.js";
import { Class } from "./class.js";
import { Macro } from "./macro.js";
import { Import } from "./import.js";
export type Statement = Macro | Variable | Function | Class | Import | Expression<any>;
export interface Exportable {
    get isExported(): boolean;
}
export declare const isExportable: <T extends Statement>(statement: T) => statement is Exportable & T;
export declare const isExported: (statement: Statement) => boolean;
