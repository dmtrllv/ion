import { Transport } from "@ion/core";
import { HttpServer } from "@ion/http";

export type WsOptions = {
	readonly port?: number;
	readonly host?: string;
	readonly tls?: {
		readonly key: string;
		readonly cert: string;
	};
};

export class WsTransport extends Transport {
	protected readonly config: WsOptions;
	protected readonly server: HttpServer;
	protected readonly usesOwnServer: boolean;

	public constructor(config: WsOptions, usesOwnServer: boolean, server: HttpServer) {
		super();
		this.config = config;
		this.usesOwnServer = usesOwnServer;
		this.server = server;
	}

	public override async start(): Promise<void> {
		if (this.usesOwnServer)
			await this.server.start();
	}
}