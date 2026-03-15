import type { App } from "./app.js";
import { Err, Ok, type MaybePromise, type Result } from "@ion/utils";

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

			if (aCtor.execOrder.before.includes(bCtor)) list.push(b);
			if (aCtor.execOrder.after.includes(bCtor)) {
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
	
	if(cycles.length !== 0)
		return Err(new DepCycleError(cycles))

	return Ok(orderedPlugins);
}

export abstract class Plugin<T extends {} = {}> {
	public static readonly execOrder: ExecOrder = createExecOrder();

	public readonly config: T;

	public constructor(config: T) {
		this.config = config;
	}

	public abstract install(app: App): MaybePromise<void>;
	public uninstall(_app: App): MaybePromise<void> {}
}

export const runAfter = <T extends typeof Plugin<any>>(type: T): ClassDecorator => (target: unknown) => {
	const ctor = target as typeof Plugin<any>;
	ctor.execOrder.after.push(type);
	type.execOrder.before.push(ctor);
}

export const runBefore = <T extends typeof Plugin<any>>(type: T): ClassDecorator => (target: unknown) => {
	const ctor = target as typeof Plugin<any>;
	ctor.execOrder.before.push(type);
	type.execOrder.after.push(ctor);
}