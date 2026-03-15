import { App, Plugin } from "@ion/core";
import type { MaybePromise } from "@ion/utils";
import { HttpServer, type HttpOptions } from "./server.js";

export class HttpPlugin extends Plugin<HttpOptions> {
	public constructor(config: HttpOptions) {
		super(config);
		
	}

	override install(app: App): MaybePromise<void> {
		app.registerTransport(new HttpServer(this.config));
	}
}

export const http = (config: HttpOptions = {}) => new HttpPlugin(config);