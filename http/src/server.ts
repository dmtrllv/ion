import { Transport } from "@ion/core";
import * as http from "node:http";
import * as https from "node:https";
import { Router } from "./router.js";
import type { HttpMethod } from "./route.js";
import { Response } from "./response.js";

type NodeServer = http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;

export type ServerReq = http.IncomingMessage;
export type ServerRes = http.ServerResponse & { req: ServerReq };

export type HttpOptions = {
	readonly port?: number;
	readonly host?: string;
	readonly tls?: {
		readonly key: string;
		readonly cert: string;
	};
};

export class HttpServer extends Transport {
	protected readonly config: HttpOptions;
	protected readonly server: NodeServer;

	public get port(): number {
		if (this.config.port)
			return this.config.port;
		return this.config.tls ? 443 : 80;
	}

	public get host(): string {
		return this.config.host || "127.0.0.1";
	}

	public get protocol(): string {
		if (this.config.tls)
			return "https";
		return "http";
	}

	protected readonly router = new Router();

	public constructor(config: HttpOptions) {
		super();
		this.config = config;
		this.server = this.createServer(this.config);
	}

	private createServer({ tls }: HttpOptions) {
		if (tls) {
			return https.createServer(tls, this.handler);
		} else {
			return http.createServer(this.handler);
		}
	}

	protected readonly handler = async (req: ServerReq, res: ServerRes) => {
		if (!req.url)
			return res.end();

		const matchedRoute = this.router.getRoute(req.url!);
		
		if(!matchedRoute)
			return res.end();
		const { route, params } = matchedRoute;
		const handler = route.handlers[req.method as HttpMethod];
		
		if (!handler)
			return res.end();

		const controller = new handler.Controller();
		const args = await Promise.all(handler.paramInjectors.map(injector => {
			// Todo this should be checked in the method decorator
			if(!injector) {
				console.error("missing injector?");
				return undefined;
			}
			return injector(req, params);
		}));
	
		const response = await handler.fn.call(controller, ...args) as Response<any>;
		if(response instanceof Response) {
			await response.write(req, res);
		} else {
			res.write(JSON.stringify(response));
		}
		return res.end();
	}

	public override start(): Promise<void> {
		return new Promise<void>((res) => {
			this.server.listen(this.port, this.host, () => {
				console.log(`Http server listening on ${this.protocol}://${this.host}:${this.port}`);
				res();
			});
		});
	}
}