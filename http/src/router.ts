import type { Controller } from "./controller.js";

export class Router {
	public static readonly get = <T extends Controller, K extends keyof T>(_path: string, ..._middleware: Middleware<any>[]) => (_target: T, _key: K, _descriptor: PropertyDescriptor) => {
		
	}

	public constructor() {
		
	}
}

export const get = Router.get;

export type Middleware<Data> = (controller: Controller, data: Data) => any;
