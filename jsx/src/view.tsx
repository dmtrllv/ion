import type { Api } from "@ion/http";
import type { MaybePromise } from "@ion/utils";

export abstract class View<P = {}> {
	public props: P;
	
	protected get state(): Awaited<ReturnType<typeof this["load"]>> {
		return this.load() as any;
	}

	public constructor(props: P) {
		this.props = props;
	}

	public load(): MaybePromise<unknown> {
		return undefined
	}

	public abstract render(): any;
}

export const api = <T extends typeof Api>(type: T): PropertyDecorator => (target, key) => {

}