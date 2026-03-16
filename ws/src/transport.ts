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

	public constructor(config: WsOptions, server?: HttpServer | undefined) {
		super();
		this.config = config;
		this.usesOwnServer = server === undefined;
		this.server = server || new HttpServer(config);
	}

	public override async start(): Promise<void> {
		if (this.usesOwnServer)
			await this.server.start();
	}
}