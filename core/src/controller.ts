import type { Constructor } from "@ion/utils";
import { Service } from "./service.js";

export abstract class Controller {
	private static services?: Record<string, Constructor<Service>>;

	public static addService<T extends typeof Controller>(this: T, key: string, service: Constructor<Service>) {
		if (!this.services)
			this.services = {};
		this.services[key as keyof typeof this.services] = service;
	}

	public static create<T extends Controller>(type: Constructor<T>): T {
		const services = (type as any as typeof Controller)?.services || {};
		const controller = new (type as any)();
		for (const k in services) {
			const service = Service.getService(services[k]!);
			(controller as any)[k] = service;
			console.log("added service", (controller as any)[k]);
		}
		return controller;
	}
}