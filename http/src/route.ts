import type { TransportRoute } from "@ion/core";
import type { HttpContext } from "./context.js";

export type HttpRoute = TransportRoute<HttpContext> & {

};
