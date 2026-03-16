import { runAfter, App, Plugin } from "@ion/core";
import type { MaybePromise } from "@ion/utils";
import { HttpPlugin, HttpServer } from "@ion/http";

import { WsTransport, type WsOptions } from "./transport.js";

@runAfter(HttpPlugin)
export class WsPlugin extends Plugin<WsOptions> {
	public override install(app: App): MaybePromise<void> {
		let server = app.getTransport(HttpServer);
		const usesOwnServer = server === null;
		if (server === null) {
			server = app.registerTransport(new HttpServer(this.config));
		}
		app.registerTransport(new WsTransport(this.config, usesOwnServer, server));
	}
}

export const ws = (config: WsOptions = {}) => new WsPlugin(config);