import { Variable } from "./var.js";
import { Function } from "./function.js";
import { Expression } from "./expression.js";
import { Class } from "./class.js";
export type Statement = Variable | Function | Class | Expression;
