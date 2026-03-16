
import type { Constructor } from "@ion/utils";
import type { View } from "../view.js";

export class Compiler {
	public compile(App: Constructor<View>) {
		console.log(getClientMeta(App));
	}
}

export type ClientMeta = {
	imports: string[];
	styles: string[];
};

const TAG = Symbol("CLIENT_META");

type ClassWithMeta = Constructor<any> & {
	[TAG]?: ClientMeta;
};

export const getClientMeta = <T>(type: Constructor<T>): Readonly<ClientMeta> | null => {
	if (TAG in type) {
		return type[TAG] as ClientMeta;
	}
	return null;
};

export const client = <T>(meta: Partial<ClientMeta> = {}) => (Class: Constructor<T>) => {
	(Class as ClassWithMeta)[TAG] = {
		imports: [],
		styles: [],
		...meta
	};
};