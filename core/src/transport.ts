export abstract class Transport {
	public abstract start(): Promise<void>;
	
	public async stop() { }
}