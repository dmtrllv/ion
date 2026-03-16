import type { App } from "./app.js";
import { Err, Ok, type Constructor, type MaybePromise, type Result } from "@ion/utils";

type ExecOrder = {
	readonly before: typeof Plugin[],
	readonly after: typeof Plugin[],
};

const createExecOrder = (): ExecOrder => ({
	before: [],
	after: [],
});

const UNSEEN = 0 as const;
const VISITING = 1 as const;
const DONE = 2 as const;

type VisitState = typeof UNSEEN | typeof VISITING | typeof DONE;

export class DepCycleError extends Error {
	public constructor(cycles: string[]) {
		super(cycles.join("\r\n"));
	}
}

export type RequiredPlugin = {
	type: Constructor<Plugin<any>>;
	config: any;
}

export const sortExecOrder = (plugins: Set<Plugin>): Result<Plugin[], DepCycleError> => {
	const orderedPlugins: Plugin[] = [];
	const cycles: string[] = [];

	const nodes = [...plugins];

	const edges = new Map<Plugin, Plugin[]>();

	for (const a of nodes) {
		const aCtor = a.constructor as typeof Plugin;
		const list: Plugin[] = [];

		for (const b of nodes) {
			if (a === b) continue;
			const bCtor = b.constructor as typeof Plugin;

			if (aCtor.execOrder?.before.includes(bCtor)) list.push(b);
			if (aCtor.execOrder?.after.includes(bCtor)) {
				(edges.get(b) ?? edges.set(b, []).get(b)!).push(a);
			}
		}

		edges.set(a, [...(edges.get(a) ?? []), ...list]);
	}

	const state = new Map<Plugin, VisitState>();
	const stack: Plugin[] = [];

	const name = (p: Plugin) => (p.constructor as any).name;

	const visit = (p: Plugin) => {
		const s = state.get(p) ?? 0;
		if (s === DONE) return;
		if (s === VISITING) {
			const i = stack.indexOf(p);
			cycles.push([...stack.slice(i), p].map(name).join(" -> "));
			return;
		}

		state.set(p, VISITING);
		stack.push(p);

		for (const n of edges.get(p) ?? []) visit(n);

		stack.pop();
		state.set(p, DONE);
		orderedPlugins.push(p);
	}

	for (const p of nodes)
		visit(p);

	orderedPlugins.reverse();

	if (cycles.length !== 0)
		return Err(new DepCycleError(cycles))

	return Ok(orderedPlugins);
};

export abstract class Plugin<T extends {} = {}> {
	public static execOrder?: ExecOrder;
	public static requiredPlugins?: RequiredPlugin[];

	public readonly config: T;

	public constructor(config: T) {
		this.config = config;
	}

	public abstract install(app: App): MaybePromise<void>;
	public uninstall(_app: App): MaybePromise<void> { }
};

export const runAfter = <T extends typeof Plugin<any>[]>(...types: T): ClassDecorator => (target: unknown) => {
	types.forEach(type => {
		const ctor = target as typeof Plugin<any>;
		if (!ctor.execOrder)
			ctor.execOrder = createExecOrder();
		ctor.execOrder.after.push(type);
		if (!type.execOrder)
			type.execOrder = createExecOrder();
		type.execOrder.before.push(ctor);
	});
};

export const runBefore = <T extends typeof Plugin<any>[]>(...types: T): ClassDecorator => (target: unknown) => {
	types.forEach(type => {
		const ctor = target as typeof Plugin<any>;
		if (!ctor.execOrder)
			ctor.execOrder = createExecOrder();
		ctor.execOrder.before.push(type);
		if (!type.execOrder)
			type.execOrder = createExecOrder();
		type.execOrder.after.push(ctor);
	});
};

export const requires = <T extends Plugin<any>>(type: new (...args: any[]) => T, config: PluginConfig<T>): ClassDecorator => (target: unknown) => {
	const ctor = target as typeof Plugin<any>;
	runAfter(type)(ctor);
	if (!ctor.requiredPlugins)
		ctor.requiredPlugins = [];
	ctor.requiredPlugins.push({ type, config });
};

export type PluginConfig<T> = T extends Plugin<infer C> ? C : never;