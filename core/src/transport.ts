export interface TransportContext {
	
	send(data: unknown): Promise<void>;
}

export type TransportHandler<Ctx> = (ctx: Ctx) => Promise<any>;

export interface TransportRoute<Ctx> {
	handler: TransportHandler<Ctx>;
}

export abstract class Transport<Ctx, Route extends TransportRoute<Ctx> = TransportRoute<Ctx>> {
	public register(_route: Route) { }

	public abstract start(): Promise<void>;
	
	public async stop() { }
}