import { isClass, type Constructor } from "@ion/utils";
import { Fragment, jsx, jsxs } from "../jsx.js";
import { Route, Redirect, } from "../router.js";
import type { Dependency } from "./dependency.js";
import { Controller } from "@ion/core";
import { Router } from "@ion/http";
import { CompiledModule } from "./module.js";
import { getViewMeta, View } from "../view.js";
import { Context } from "../context.js";
import { Renderer } from "../client/renderer.js";

export class Compiler {
	public static readonly frameworkDependencies: Set<Dependency> = new Set([
		jsx,
		jsxs,
		Fragment,
		View,
		Context,
		Route,
		Redirect,
		Renderer
	]);

	public readonly compiledDependencies = new Map<Dependency, CompiledModule>();

	private frameworkImports: string = "";

	public constructor() {
		Compiler.frameworkDependencies.forEach(dep => this.compileDependency(dep, true));
		Compiler.frameworkDependencies.forEach(dep => {
			const mod = this.compiledDependencies.get(dep)!;
			this.frameworkImports += `import ${mod.typeName} from "${mod.path}";\r\n`
		})
	}

	public compileDependencies(deps: Set<Dependency>) {
		deps.forEach(dep => this.compileDependency(dep));
	}

	public compileDependency(dep: Dependency, force: boolean = false): void {
		if (this.compiledDependencies.has(dep))
			return;

		if (dep.prototype instanceof Controller) {
			this.compileController(dep as typeof Controller);
		} else if (isClass(dep)) {
			this.compileClass(dep, force);
		} else {
			this.compileFunction(dep);
		}
	}

	private compileFunction(dep: Function) {
		if (!dep.name) {
			console.log("Anonymous or arrow functions are not supported!");
			return;
		}

		this.compiledDependencies.set(dep, new CompiledModule(dep, `export ${dep.toString()}`, []));
	}

	private compileClass(dep: Constructor<any>, force: boolean) {
		const meta = getClientMeta(dep);
		if (!meta) {
			if (force) {
				this.compiledDependencies.set(dep, new CompiledModule(dep, `export ${dep.toString()}`, []));
				return;
			}
			console.log(`Class ${dep} does not has a @client decorator!`);
			return;
		}

		meta.include.forEach(dep => this.compileDependency(dep));

		// TODO if its a view: decorate the states, create/inject controllers
		if(dep.prototype instanceof View) {
			const viewMeta = getViewMeta(dep);
			if(viewMeta) {
				console.log("TODO: inject view meta code...");
			}
		}

		this.compiledDependencies.set(dep, new CompiledModule(dep, `export ${dep.toString()}`, meta.include));
	}

	private compileController(dep: Dependency) {
		const handlers = Router.getControllerHandlers(dep as typeof Controller);

		const handlerFunctions = handlers.map(handler => {
			const meta = Router.getHandlerMeta(dep as typeof Controller, handler);
			if (!meta || !meta.path)
				return "";
			const paramIndices: Record<string, number> = {};
			meta.paramInjectors.forEach((p, i) => {
				if (typeof p?.type === "object" && ("param" in p.type)) {
					paramIndices[p.type.param] = i;
				}
			});
			const bodyIndex = meta.paramInjectors.findIndex(p => p?.type === "body");
			return `\t${handler} = (...args) => {
		const bodyIndex = ${bodyIndex};
		const paramIndices = ${JSON.stringify(paramIndices)};
		let path = "${meta.path}";
		Object.keys(paramIndices).forEach(p => {
			const val = args[paramIndices[p]];
			path = path.replace(\`:\${p}\`, val);
		});
		const data = bodyIndex > -1 ? args[bodyIndex] : {};
		const body = ${meta.method == "GET" ? "undefined" : "JSON.stringify(data)"};
		const query = ${meta.method == "GET" ? `"?" + new URLSearchParams(data).toString()` : ""};
		path += query;
		return fetch(path, { method: "${meta.method}", body }).then(res => res.json());
	};\r\n`;
		}).join("");

		const source = `export class ${dep.name} {\r\n${handlerFunctions}}`;

		this.compiledDependencies.set(dep, new CompiledModule(dep, source, []));
	}
}

export type ClientMeta = {
	include: Dependency[];
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
		include: [],
		styles: [],
		...meta
	};
};