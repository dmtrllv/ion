import { App, Controller, Plugin, requires } from "@ion/core";
import type { View, ViewType } from "./view.js";
import { HttpPlugin, HttpServer, Response, type ServerReq, type ServerRes } from "@ion/http";
import { Compiler } from "./server/compiler.js";
import { DepResolver } from "./server/resolver.js";
import { AppRes } from "./server/renderer.js";

export type JsxCompilerOptions = {
	App: ViewType<View>;
	basePath: string;
};

class JsRes extends Response<string> {
	override write(_: ServerReq, res: ServerRes) {
		res.setHeader("Content-Type", "application/javascript");
		res.write(this.value);
	}
}

@requires(HttpPlugin, { host: "localhost", port: 3001 })
export class JsxPlugin extends Plugin<JsxCompilerOptions> {
	override install(app: App): void {
		const server = app.getTransport(HttpServer);

		if (!server)
			return console.warn("Expected to have an http server!");

		const deps = DepResolver.resolve(this.config.App);

		const compiler = new Compiler();

		compiler.compileDependencies(deps);

		class JsxAppRoutes extends Controller { }

		for (const [_, value] of compiler.compiledDependencies) {
			value.compileWithImports(compiler.compiledDependencies);

			server.router.registerRoute({
				Controller: JsxAppRoutes,
				key: "",
				middleware: [],
				paramInjectors: [],
				method: "GET",
				fn: () => new JsRes(value.compiledSource),
				path: value.path
			});
		}

		const routePath = this.config.basePath === "/" ? "/*" : `${this.config.basePath}/*`;

		server.router.registerRoute({
			Controller: JsxAppRoutes,
			key: "",
			middleware: [],
			paramInjectors: [],
			method: "GET",
			fn: async () => {
				return new AppRes({ App: this.config.App, compiledDependencies: compiler.compiledDependencies });
			},
			path: routePath
		});
	}
}

export const jsxCompiler = (App: ViewType<View>, basePath: string) => new JsxPlugin({
	App,
	basePath
});