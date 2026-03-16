import type { Controller } from "@ion/core";
import type { MaybePromise } from "@ion/utils";

export abstract class View<P extends {} = {}> {
	public props: P;

	protected get state(): Awaited<ReturnType<typeof this["load"]>> {
		return this.load(this.props) as any;
	}

	public constructor(props: P = {} as P) {
		this.props = props;
	}

	public load(_props: P): MaybePromise<{}> {
		return {}
	}

	public abstract render(props: P): any;
}

export const inject = <T extends typeof Controller>(type: T): PropertyDecorator => (target, key) => {
	console.log("use controller", type, target, key);
}

export type ViewProps<T extends View<any>> = T extends View<infer P> ? P : never;