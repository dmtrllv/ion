import { App, Plugin, runAfter } from "@ion/core";
import type { View } from "./view.js";
import type { Constructor } from "@ion/utils";
import { HttpPlugin } from "@ion/http";

export type JsxCompilerOptions = {
	App: Constructor<View>;
	/** The base path for the router */
	basePath: string;
};

@runAfter(HttpPlugin)
export class JsxPlugin extends Plugin<JsxCompilerOptions> {
	override install(_app: App): void {

	}
}

export const jsxCompiler = (App: Constructor<View>, basePath: string) => new JsxPlugin({
	App,
	basePath
});