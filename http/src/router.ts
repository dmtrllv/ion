import type { Controller } from "@ion/core";
import { type HttpMethod, type Middleware, type ParamInjector, type RouteMeta } from "./route.js";
import { normalize } from "path/posix";
import type { Constructor } from "@ion/utils";
import type { Request } from "./request.js";
import type { ServerReq } from "./server.js";

import "reflect-metadata";

const API_TAG = Symbol("API_TAG");

export class Router {
	private static meta: Map<typeof Controller, Record<string, RouteMeta>> = new Map();

	public static getControllerHandlers<T extends typeof Controller>(type: T): string[] {
		const map = Router.meta.get(type);
		if (map) {
			return Object.keys(map);
		}
		return [];
	}

	public static getHandlerMeta<T extends typeof Controller>(type: T, key: string): RouteMeta | null {
		return this.meta.get(type)?.[key] || null
	}

	private static getRouteMap(type: typeof Controller): Record<string, RouteMeta> {
		if (!Router.meta.has(type)) {
			Router.meta.set(type, {});
		}

		return Router.meta.get(type)!;
	}

	private static getRouteMeta(type: Constructor<Controller>, key: string): RouteMeta {
		const map = this.getRouteMap(type as any);
		if (!(key in map)) {
			map[key] = {
				Controller: type,
				key,
				middleware: [],
				paramInjectors: []
			}
		}

		return map[key]!;
	}

	public static route = (path: string): ClassDecorator => (Class: unknown) => {
		const ctor = Class as typeof Controller;
		const routes = this.getRouteMap(ctor);
		for (const key in routes) {
			const route = routes[key]!;
			route.path = normalize(path + route.path);
		}
	}

	private static readonly createMethodDeco = (method: HttpMethod) => {
		return <T extends Controller, K extends keyof T>(path: string, ...middleware: Middleware<any>[]): MethodDeco<T, K> => {
			return (target: any, key, descriptor) => {
				const ctor = target.constructor as Constructor<Controller>;

				const meta = Router.getRouteMeta(ctor, key.toString());
				Object.assign(meta, {
					middleware,
					fn: descriptor.value,
					method,
					path,
				});
			};
		};
	}

	private static readonly parseBody = (req: ServerReq): Promise<string> => {
		return new Promise<string>((resolve, reject) => {
			let data = "";

			req.on("data", chunk => {
				data += chunk;
			});

			req.on("end", () => {
				resolve(data);
			});

			req.on("error", err => {
				reject(err);
			});
		});
	}

	public static readonly body = <T, K extends keyof T, I extends number>(target: T, key: K, index: I): BodyDecoReturn<T, K, I> => {
		const ctor = (target as any).constructor as Constructor<Controller>;
		const meta = Router.getRouteMeta(ctor, key.toString());
		meta.paramInjectors[index] = Object.assign(async (req: any) => {
			// todo validate parse etc...
			return JSON.parse(await Router.parseBody(req));
		}, { type: "body" }) as any;
		return void (0) as any;
	};

	public static readonly param = <T, K extends keyof T, I extends number>(name: string) => (target: T, key: K, index: I): ParamDecoReturn<T, K, I> => {
		// TODO check if the name matches one of the params in the path
		if (name.startsWith(":"))
			name = name.substring(1);
		const ctor = (target as any).constructor as Constructor<Controller>;
		const type = Reflect.getMetadata('design:paramtypes', (target as any), key as any)[index];
		const meta = Router.getRouteMeta(ctor, key.toString());
		meta.paramInjectors[index] = Object.assign((_: any, params: Record<string, string>) => {
			const value = params[name];
			if (value !== undefined)
				return type(value);
			return value;
		}, { type: { param: name } }) as any;
		return void (0) as any;
	};

	public static readonly get = this.createMethodDeco("GET");
	public static readonly post = this.createMethodDeco("POST");
	public static readonly put = this.createMethodDeco("PUT");
	public static readonly del = this.createMethodDeco("DELETE");

	// TODO: create a overload for class decorators
	public static readonly api: MethodDecorator = function (_target, _key, descriptor) {
		const originalMethod = descriptor.value as Function;
		Object.assign(originalMethod, { [API_TAG]: API_TAG });
		//descriptor.value = (async function (this: any, ...args: any[]) {
		//	const data = (await originalMethod.call(this, ...args)) || {};
		//	return json(data);
		//}) as any;

		//return descriptor;
	}

	private readonly root = new RouteTreeNode("/", "/");

	public constructor() {
		for (const routes of Router.meta.values()) {
			for (const k in routes) {
				this.registerRoute(routes[k]!);
			}
		}
	}

	public registerRoute(route: RouteMeta) {
		if (!route.path)
			return console.log(`Missing path?!?`);
		if (!route.method)
			return console.log(`Missing method?!?`);
		if (!route.fn)
			return console.log(`Missing fn?!?`);

		const parts = route.path.split("/").filter(s => s!!);

		let target = this.root;

		parts.forEach(part => { target = target.getOrAdd(part); });
		target.setHandler(route.method, route.Controller, route.paramInjectors, route.fn);
	}

	public readonly getHandler = (path: string, method: HttpMethod): MatchedRouteHandler | null => {
		const parts = path.split("/").filter(s => !!s);

		let target = this.root;
		let lastMatchAll: RouteTreeNode | null = null;

		for (const p of parts) {
			if (p in target.children)
				target = target.children[p]!;
			else if (target.paramChild)
				target = target.paramChild;
			else if (target.matchAllChild)
				lastMatchAll = target = target.matchAllChild;
			else {
				if (lastMatchAll && lastMatchAll.handlers[method]) {
					return {
						params: {},
						path,
						handler: lastMatchAll.handlers[method]!
					};
				}
				return null;
			}
		}

		if (!target.handlers[method]) {
			const handler = target.matchAllChild?.handlers[method];
			if (!handler) {
				return null;
			}

			return {
				params: {},
				path,
				handler
			}
		}

		return {
			params: {},
			path,
			handler: target.handlers[method]!
		};
	}
}

export const route = Router.route;
export const get = Router.get;
export const post = Router.post;
export const put = Router.put;
export const del = Router.del;
export const param = Router.param;
export const body = Router.body;
export const api = Router.api;

export const isApi = (obj: Function) => API_TAG in obj;

type ParamType<T, K extends keyof T, I extends number> = T[K] extends (...args: infer Args) => any ? Args[I] : never;

type ParamError<T extends string> = { error: T };

type ParamDecoReturn<T, K extends keyof T, I extends number> = ParamType<T, K, I> extends string | number ? void : ParamError<"Param must be a string or number">;

type BodyDecoReturn<T, K extends keyof T, I extends number> = ParamType<T, K, I> extends Request ? void : ParamError<"Param must be a string or number">;

type MethodDeco<T, K extends keyof T> = (target: T, key: K, descriptor: PropertyDescriptor) => void;

type MatchedRouteHandler = {
	readonly handler: RouteHandler;
	readonly path: string;
	readonly params: Record<string, string>;
}

class RouteTreeNode {
	public readonly children: Record<string, RouteTreeNode> = {};
	public paramChild: RouteTreeNode | null = null;
	public matchAllChild: RouteTreeNode | null = null;

	public readonly handlers: Partial<Record<HttpMethod, RouteHandler>> = {};

	public readonly name: string;
	public readonly fullPath: string;

	public constructor(name: string, fullPath: string) {
		this.name = name;
		this.fullPath = fullPath;
	}

	public getOrAdd(part: string): RouteTreeNode {
		const fullPath = (this.fullPath.endsWith("/") ? this.fullPath : this.fullPath + "/") + part;
		if (part === "*") {
			if (!this.matchAllChild)
				this.matchAllChild = new RouteTreeNode("*", fullPath);
			return this.matchAllChild;
		} else if (part.startsWith(":")) {
			if (!this.paramChild)
				this.paramChild = new RouteTreeNode(part, fullPath);
			return this.paramChild;
		} else {
			if (!this.children[part])
				this.children[part] = new RouteTreeNode(part, fullPath);
			return this.children[part]!;
		}
	}

	public setHandler(method: HttpMethod, Controller: Constructor<Controller>, paramInjectors: ParamInjector[], fn: Function) {
		if (this.handlers[method])
			throw new Error(`Route ${this.fullPath} already has an ${method} method set! See ${Controller.name}.${fn.name}`);
		this.handlers[method] = { handler: fn, Controller, paramInjectors }
	}

}

export type RouteHandler = {
	handler: Function;
	Controller: Constructor<Controller>;
	paramInjectors: ParamInjector[];
}