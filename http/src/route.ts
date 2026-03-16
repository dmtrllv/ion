import { Controller } from "@ion/core";
import type { Constructor } from "@ion/utils";
import type { ServerReq } from "./server.js";

export type RouteMeta = {
	key: string;
	path?: string;
	method?: HttpMethod;
	Controller: Constructor<Controller>,
	fn?: Function,
	middleware: Middleware<any>[];
	paramInjectors: ParamInjector[];
};

export class Route {
	readonly handlers: RouteHandlers = {};
	readonly path: string;

	public constructor(path: string) {
		this.path = path;
	}

	public setHandler(method: HttpMethod, type: Constructor<Controller>, fn: Function, middleware: Middleware<any>[], paramInjectors: ParamInjector[]) {
		if (method in this.handlers)
			throw new Error(`Route ${this.path} already has a ${method} handler set! (See Controller ${this.handlers[method]!.Controller.name})`);
		this.handlers[method] = {
			Controller: type,
			fn,
			middleware,
			paramInjectors
		};
	}

	public readonly setParamInjector = (_method: HttpMethod, _index: number, _injector: ParamInjector) => {
		console.log("set param injector");
	}
};

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export type Middleware<Data> = (data: Data) => any;

export type RouteHandlers = {
	[K in HttpMethod]?: Handler;
};

export type Handler = {
	readonly Controller: Constructor<Controller>,
	readonly fn: Function,
	readonly middleware: Middleware<any>[];
	readonly paramInjectors: ParamInjector[];
};

type ParamInjector = undefined | ((req: ServerReq, params: Record<string, string>) => unknown);