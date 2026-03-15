export class RequestCache {
	private readonly cache: Record<string, Record<string, any>> = {}; 
	
	public constructor() {}

	public async get(method: string, path: string, init: () => Promise<any>): Promise<any> {
		if(!this.cache[path]) {
			this.cache[path] = {}
		} 
		if(!this.cache[path][method]) {
			const data = await init();
			this.cache[path][method] = data;
		}
		return this.cache[path][method]!;
	}
}