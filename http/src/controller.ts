import type { App } from "@ion/core";
import { RequestCache } from "./cache.js";
import type { ServerReq, ServerRes } from "./server.js";

export abstract class Controller {
	protected readonly req: ServerReq;
	protected readonly res: ServerRes;
	public readonly app: App;
	public readonly cache: RequestCache;

	public constructor(app: App, req: ServerReq, res: ServerRes, cache: RequestCache = new RequestCache()) {
		this.app = app;
		this.req = req;
		this.res = res;
		this.cache = cache;
	}
}

export abstract class Api extends Controller {}