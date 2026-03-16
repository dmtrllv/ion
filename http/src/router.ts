import type { Controller } from "@ion/core";
import { Route, type HttpMethod, type Middleware, type RouteMeta } from "./route.js";
import { normalize } from "path/posix";
import type { Constructor } from "@ion/utils";
import type { Request } from "./request.js";
import type { ServerReq } from "./server.js";

import "reflect-metadata";

export class Router {
	private static meta: Map<typeof Controller, Record<string, RouteMeta>> = new Map();

	private static getRouteMap(type: typeof Controller): Record<string, RouteMeta> {
		if (!Router.meta.has(type)) {
			Router.meta.set(type, {});
		}

		return Router.meta.get(type)!;
	}

	private static getRouteMeta(type: Constructor<Controller>, key: string): RouteMeta {
		const map = this.getRouteMap(type);
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
		meta.paramInjectors[index] = async (req) => {
			// todo validate parse etc...
			return JSON.parse(await Router.parseBody(req));
		};
		return void (0) as any;
	};

	public static readonly param = <T, K extends keyof T, I extends number>(name: string) => (target: T, key: K, index: I): ParamDecoReturn<T, K, I> => {
		// TODO check if the name matches one of the params in the path
		if(name.startsWith(":"))
			name = name.substring(1);
		const ctor = (target as any).constructor as Constructor<Controller>;
		const type = Reflect.getMetadata('design:paramtypes', (target as any), key as any)[index];
		const meta = Router.getRouteMeta(ctor, key.toString());
		meta.paramInjectors[index] = (_, params) => {
			const value = params[name];
			if(value !== undefined)
				return type(value);
			return value;
		};
		return void (0) as any;
	};

	public static readonly get = this.createMethodDeco("GET");
	public static readonly post = this.createMethodDeco("POST");
	public static readonly put = this.createMethodDeco("PUT");
	public static readonly del = this.createMethodDeco("DELETE");

	private readonly routes: Record<string, Route> = {};
	private readonly paramRoutes: Record<string, Route> = {};

	public constructor() {
		for (const routes of Router.meta.values()) {
			for (const k in routes) {
				this.registerRoute(routes[k]!);
			}
		}
	}

	private registerRoute(route: RouteMeta) {
		if (!route.path)
			return console.log(`Missing path?!?`);
		if (!route.method)
			return console.log(`Missing method?!?`);
		if (!route.fn)
			return console.log(`Missing fn?!?`);

		const isParamRoute = route.path.split("/").filter(s => !!s).find(s => s.startsWith(":")) !== undefined;
		if (isParamRoute) {
			this.registerParamRoute(route as Required<RouteMeta>);
		} else {
			if (!(route.path in this.routes)) {
				this.routes[route.path] = new Route(route.path);
			}
			this.routes[route.path]!.setHandler(route.method, route.Controller, route.fn, route.middleware, route.paramInjectors);
		}
	}

	private registerParamRoute(route: Required<RouteMeta>) {
		if (!(route.path in this.routes)) {
			this.paramRoutes[route.path] = new Route(route.path);

		}
		this.paramRoutes[route.path]!.setHandler(route.method, route.Controller, route.fn, route.middleware, route.paramInjectors);
	}

	public getRoute(path: string): MatchedRoute | null {
		if (path in this.routes) {
			return {
				route: this.routes[path]!,
				params: {},
				path
			};
		}

		const parts = path.split("/").filter(s => !!s);

		const matches: MatchedRoute[] = Object.keys(this.paramRoutes).map(key => {
			const matchParts = key.split("/").filter(s => !!s);
			const params: Record<string, string> = {};
			if (parts.length !== matchParts.length)
				return null;
			for (let i = 0; i < parts.length; i++) {
				const part = parts[i]!;
				const matchPart = matchParts[i]!;
				if (matchPart.startsWith(":")) {
					params[matchPart.substring(1)] = part;
				} else if (part !== matchPart) {
					return null;
				}
			}
			return {
				path: key,
				params,
				route: this.paramRoutes[key]
			};
		}).filter(s => s !== null) as MatchedRoute[];

		if (matches.length > 1) {
			console.warn(`Route matching conflict! check routes ${matches.map(m => m.path).join(", ")}`);
		}

		return matches[0] || null;
	}
}

export const route = Router.route;
export const get = Router.get;
export const post = Router.post;
export const put = Router.put;
export const del = Router.del;
export const param = Router.param;
export const body = Router.body;

type ParamType<T, K extends keyof T, I extends number> = T[K] extends (...args: infer Args) => any ? Args[I] : never;

type ParamError<T extends string> = { error: T };

type ParamDecoReturn<T, K extends keyof T, I extends number> = ParamType<T, K, I> extends string | number ? void : ParamError<"Param must be a string or number">;


type BodyDecoReturn<T, K extends keyof T, I extends number> = ParamType<T, K, I> extends Request ? void : ParamError<"Param must be a string or number">;


type MethodDeco<T, K extends keyof T> = (target: T, key: K, descriptor: PropertyDescriptor) => void;

type MatchedRoute = {
	readonly route: Route;
	readonly path: string;
	readonly params: Record<string, string>;
}