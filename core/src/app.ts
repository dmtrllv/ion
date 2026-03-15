import { Ok, Result, type Constructor } from "@ion/utils";
import { sortExecOrder, type Plugin } from "./plugin.js";
import { Registry } from "./registry.js";
import type { Transport, TransportRoute } from "./transport.js";
import type { Store } from "./store.js";

type PluginsArray = [Plugin, ...Plugin[]];

export class App {
	protected readonly transports: Registry<Transport<any, any>> = new Registry();

	protected readonly plugins: Set<Plugin> = new Set();
	private installedPlugins: readonly Plugin[] = [];

	protected stores: Map<typeof Store, Store<any>> = new Map();

	public constructor() { }

	public use(...plugins: PluginsArray) {
		plugins.forEach(p => this.plugins.add(p));
	}

	public registerTransport<Ctx, Route extends TransportRoute<Ctx> = TransportRoute<Ctx>>(transport: Transport<Ctx, Route>) {
		this.transports.register(transport);
	}

	public getTransport<T extends Transport<any, any>>(type: Constructor<T>): Result<T, Error> {
		return this.transports.get(type);
	}

	public registerStore() {

	}

	public async start(): Promise<Result<void, Error>> {
		let result = await sortExecOrder(this.plugins).andThen(this.installPlugins);
		return result.mapErr();
	}

	protected installPlugins = async (plugins: readonly Plugin[]): Promise<Result<void, Error>> => {
		this.installedPlugins = plugins;
		for (const plugin of plugins) {
			console.log(`Installing ${plugin.constructor.name}`);
			// TODO: this should return a Result<T, PluginError>
			await plugin.install(this);
		}

		for (const transport of this.transports.all()) {
			console.log(`Starting ${transport.constructor.name}`);
			// TODO: this should return a Result<T, TransportError>
			await transport.start();
		}

		return Ok();
	}


	public async stop(): Promise<void> {
		const transports = this.transports.all().toReversed();
		for (const transport of transports) {
			console.log(`Stopping ${transport.constructor.name}`);
			// TODO: this should return a Result<T, TransportError>
			await transport.stop();
		}

		const plugins = this.installedPlugins.toReversed();
		for (const plugin of plugins) {
			console.log(`Uninstalling ${plugin.constructor.name}`);
			// TODO: this should return a Result<T, TransportError>
			await plugin.uninstall(this);
		}
	}
}