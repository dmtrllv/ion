import type { Constructor, MaybePromise } from "@ion/utils";
import type { Dependency } from "./server/dependency.js";
import { Controller } from "@ion/core";
import { Context } from "./context.js";

//const META = Symbol("META");

type ViewMeta = {
	stateKeys: string[];
	ctxMap: Record<string, Dependency>;
	controllerMap: Record<string, Constructor<Controller>>;
};

export abstract class View<P extends {} = {}> {
	private static meta?: ViewMeta;

	public readonly props: P;

	public constructor(props: P = {} as P) {
		this.props = props;
	}

	public load(_props: P): MaybePromise<void> {}

	public abstract render(props: P): any;
}

export const getViewMeta = (view: ViewType<View<any>>): ViewMeta | null => (view as typeof View<any>)["meta"] || null;

export type ViewProps<T extends View<any>> = T extends View<infer P> ? P : never;
export type ViewType<T extends View<any> = View> = new (props: ViewProps<T>) => T;

const viewMeta = (type: View<any>) => {
	const ctor = (type.constructor as typeof View);
	if (!ctor["meta"]) {
		ctor["meta"] = {
			stateKeys: [],
			controllerMap: {},
			ctxMap: {}
		};
	}
	return ctor["meta"]!;
}

export const state = <T extends View<any>>(type: T, key: string): any => {
	viewMeta(type).stateKeys.push(key);
};

export const controller = <T extends View<any>>(type: T, key: string): any => {
	const ControllerType = Reflect.getMetadata("design:type", type, key.toString());
	if(!(ControllerType.prototype instanceof Controller)) {
		throw new Error(`${type.constructor.name}.${key} with type ${ControllerType.name} is not a Controller!`);
	}
	viewMeta(type).controllerMap[key] = ControllerType;
};

export const ctx = <T extends View<any>>(type: T, key: string): any => {
	const ContextType = Reflect.getMetadata("design:type", type, key.toString());
	if(!(ContextType.prototype instanceof Context)) {
		throw new Error(`${type.constructor.name}.${key} with type ${ContextType.name} is not a Context!`);
	}
	viewMeta(type).ctxMap[key] = ContextType;
};