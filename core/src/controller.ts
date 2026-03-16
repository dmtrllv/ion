import type { Service } from "./service.js";

export abstract class Controller {

}

export const service = <T extends Controller, K extends keyof T>() => (_Class: T, _key: K): ServiceDecoReturn<T, K> => {
	return void(0) as any;
}

type ServiceDecoReturn<T extends Controller, K extends keyof T> = T[K] extends Service ? void : `Expected a service type!`;