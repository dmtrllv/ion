import { View, type ViewType } from "../view.js";

export type ListProps<T extends {}> = {
	readonly items: T[];
	readonly view: ViewType<View<T>>;
};

export class List<T extends {}> extends View<ListProps<T>> {
	public override render() {
		throw new Error("Method not implemented.");
	}
}