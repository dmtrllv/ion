import type { Controller } from "./controller.js";

export class Router {
	public static get<T extends Controller, K extends keyof T>(_path: string, ..._middleware: Middleware<any>[]): MethodDeco<T, K>;
	public static get<T extends Controller, K extends keyof T>(..._middleware: Middleware<any>[]): MethodDeco<T, K>;
	public static get<T extends Controller, K extends keyof T>(...args: any[]): MethodDeco<T, K> {
		return (_target: T, _key: K, _descriptor: PropertyDescriptor) => {

		};
	}

	public constructor() {

	}
}

type MethodDeco<T extends Controller, K extends keyof T> = (_target: T, _key: K, _descriptor: PropertyDescriptor) => void;

export const get = Router.get;
export const param: ParameterDecorator = () => {}

export type Middleware<Data> = (controller: Controller, data: Data) => any;
