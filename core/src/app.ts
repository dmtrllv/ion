import { readFileSync } from "node:fs";
import path from "node:path";

import { Ok, Result, type Constructor } from "@ion/utils";
import { sortExecOrder, type Plugin, type RequiredPlugin } from "./plugin.js";
import { Registry } from "./registry.js";
import type { Transport } from "./transport.js";
import { loadModules } from "./bootstrap.js";

type PluginsArray = [Plugin, ...Plugin[]];

export class App {
	protected readonly transports: Registry<Transport> = new Registry();

	protected readonly plugins: Set<Plugin> = new Set();
	private installedPlugins: readonly Plugin[] = [];

	public readonly distDir: string;
	public readonly srcDir: string;

	public constructor() {
		const cwd = process.cwd();
		const pkg = JSON.parse(readFileSync(path.resolve(cwd, "package.json"), "utf-8"));
		const entryPath = path.resolve(cwd, pkg.main);
		this.distDir = path.dirname(entryPath);
		this.srcDir = path.resolve(cwd, "src");
	}

	public use(...plugins: PluginsArray) {
		plugins.forEach(p => {
			this.plugins.add(p);
		});
	}

	public registerTransport<T extends Transport>(transport: T): T {
		this.transports.register(transport);
		return transport;
	}

	public getTransport<T extends Transport>(type: Constructor<T>): T | null {
		return this.transports.get(type);
	}

	public async start(): Promise<Result<void, Error>> {
		const loadResult = await loadModules(this.distDir);
		if (loadResult.isErr()) {
			return loadResult.mapErr(errors => {
				let message = `Module load error!`;
				errors.forEach(error => {
					message += `\r\n\t${error.message} at (${error.path})`;
				});
				return new Error(message);
			});
		}
		this.plugins.forEach(plugin => {
			const ctor = plugin.constructor as typeof Plugin;
			ctor.requiredPlugins?.forEach(({ type, config }: RequiredPlugin) => {
				if (!this.getPlugin(type)) {
					this.plugins.add(new type(config))
				}
			});
		});
		const plugins = sortExecOrder(this.plugins);
		const result = await plugins.andThen(this.installPlugins);
		return result.mapErr();
	}

	protected getPlugin<T extends Plugin<any>>(type: Constructor<T>): T | null {
		for(const plugin of this.plugins.values()) {
			if(plugin.constructor === type) {
				return plugin as T;
			}
		}
		return null;
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