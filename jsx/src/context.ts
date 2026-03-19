import { View } from "./view.js";

export abstract class Context<P extends {} = {}> extends View<P> {
	public render(props: any) {
		return props.children || [];
	}
}