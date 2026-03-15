import type { App } from "@ion/core";
import { RequestCache } from "./cache.js";
import type { ServerReq, ServerRes } from "./server.js";

export abstract class Controller {
	public static readonly route = (path: string): ClassDecorator => (Class) => {
		throw new Error("TODO");
	}

	protected readonly req: ServerReq;
	protected readonly res: ServerRes;
	protected readonly app: App;
	protected readonly cache: RequestCache;

	public constructor(app: App, req: ServerReq, res: ServerRes, cache: RequestCache = new RequestCache()) {
		this.app = app;
		this.req = req;
		this.res = res;
		this.cache = cache;
	}
}

export const route = Controller.route;

export abstract class Api extends Controller { }