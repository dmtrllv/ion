import { runAfter, App, Plugin } from "@ion/core";
import type { MaybePromise } from "@ion/utils";
import { HttpPlugin, HttpServer } from "@ion/http";

import { WsTransport, type WsOptions } from "./transport.js";

@runAfter(HttpPlugin)
export class WsPlugin extends Plugin<WsOptions> {
	public override install(app: App): MaybePromise<void> {
		const server = app.getTransport(HttpServer).or(undefined);
		app.registerTransport(new WsTransport(this.config, server));
	}
}

export const ws = (config: WsOptions = {}) => new WsPlugin(config);