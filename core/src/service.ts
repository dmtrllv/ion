import type { Controller } from "./controller.js"
import type { Constructor } from "@ion/utils";

import "reflect-metadata";

export abstract class Service {
	private static readonly services = new Map<Constructor<Service>, Service>();

	public static injectedServices?: Record<string, Constructor<Service>>;

	// @internal
	public static addService<T extends typeof Service>(this: T, key: string, service: Constructor<Service>) {
		if (!this.injectedServices)
			this.injectedServices = {};
		this.injectedServices[key as keyof typeof this.injectedServices] = service;
	}

	public static readonly service = <T extends Controller | Service, K extends keyof T>(Class: T, key: K): ServiceDecoReturn<T, K> => {
		const type = Reflect.getMetadata("design:type", Class, key.toString());

		if (!type)
			throw new Error(`Could not get service type of ${(Class as any).name}.${key.toString()}`);

		if (!this.services.has(type))
			this.services.set(type, new type());

		const ctor = Class.constructor as typeof Controller;

		ctor.addService(key.toString(), type);

		return void (0) as any;
	};

	// @internal
	public static readonly all = (): Service[] => Array.from(this.services.values());
	
	// @internal
	public static getService(type: Constructor<Service>): Service | null {
		return this.services.get(type) || null;
	}
}

export const service = Service.service;

type ServiceDecoReturn<T extends Controller, K extends keyof T> = T[K] extends Service ? void : `Expected a service type!`;