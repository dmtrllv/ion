import { readFileSync } from "node:fs";
import path from "node:path";

import { Ok, Result, type Constructor } from "@ion/utils";
import { sortExecOrder, type Plugin } from "./plugin.js";
import { Registry } from "./registry.js";
import type { Transport } from "./transport.js";
import { loadModules } from "./bootstrap.js";

type PluginsArray = [Plugin, ...Plugin[]];

export class App {
	protected readonly transports: Registry<Transport> = new Registry();

	protected readonly plugins: Set<Plugin> = new Set();
	private installedPlugins: readonly Plugin[] = [];

	protected readonly srcDir: string;

	public constructor() {
		const cwd = process.cwd();
		const pkg = JSON.parse(readFileSync(path.resolve(cwd, "package.json"), "utf-8"));
		const entryPath = path.resolve(cwd, pkg.main);
		this.srcDir = path.dirname(entryPath);
	}

	public use(...plugins: PluginsArray) {
		plugins.forEach(p => this.plugins.add(p));
	}

	public registerTransport(transport: Transport) {
		this.transports.register(transport);
	}

	public getTransport<T extends Transport>(type: Constructor<T>): Result<T, Error> {
		return this.transports.get(type);
	}

	public async start(): Promise<Result<void, Error>> {
		const loadResult = await loadModules(this.srcDir);
		if (loadResult.isErr()) {
			return loadResult.mapErr(errors => {
				let message = `Module load error!`;
				errors.forEach(error => {
					message += `\r\n\t${error.message} at (${error.path})`;
				});
				return new Error(message);
			});
		}
		const plugins = sortExecOrder(this.plugins);
		const result = await plugins.andThen(this.installPlugins);
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