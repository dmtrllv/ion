import { Transport } from "@ion/core";
import * as http from "node:http";
import * as https from "node:https";
import type { HttpContext } from "./context.js";
import { Router } from "./router.js";

type NodeServer = https.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;

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

export class HttpServer extends Transport<HttpContext> {
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
			return https.createServer(this.handler);
		}
	}

	protected readonly handler = (req: http.IncomingMessage, res: http.OutgoingMessage) => {
		console.log(`[${req.method}] ${req.url}`);
		res.end();
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