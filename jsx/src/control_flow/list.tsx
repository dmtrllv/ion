import { View } from "../view.js";

export type ListProps<T extends {}> = {
	readonly items: T[];
	readonly view: View<T> | JSX.FC<T>;
};

export class List<T extends {}> extends View<ListProps<T>> {
	public override render() {
		throw new Error("Method not implemented.");
	}
}