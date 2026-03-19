import type { Dependency } from "./dependency.js";
import { Fragment } from "../jsx.js";
import type { CompiledModule } from "./module.js";
import { Compiler, getClientMeta } from "./compiler.js";
import { getViewMeta, type View, type ViewType } from "../view.js";
import { Context } from "../context.js";
import { RouterContext } from "../router.js";
import type { Constructor } from "@ion/utils";
import { Controller } from "@ion/core";
import { HtmlRes, Response, type ServerReq, type ServerRes } from "@ion/http";

export type DependencySet = Set<Dependency>;

export type ContextMap = Map<Constructor<Context>, Context>;

export type AppResData = {
	App: ViewType<View<{}>>;
	compiledDependencies: Map<Dependency, CompiledModule>;
};

export class AppRes extends Response<AppResData> {
	override async write(req: ServerReq, res: ServerRes) {
		const { App, compiledDependencies } = this.value;

		const dependencySet: DependencySet = new Set();
		const ctxMap: ContextMap = new Map();
		ctxMap.set(RouterContext, new RouterContext({ path: req.url!.split("?")[0]! }));
		const appMeta = getClientMeta(App);
		appMeta?.include.forEach(dep => dependencySet.add(dep));

		const app = new App({});
		const jsx = await app.render(app.props);
		const appHtml = await parse(jsx, ctxMap, dependencySet);

		const scripts: string[] = [];
		const styles: string[] = [];
		const title: string = "";

		//Compiler.frameworkDependencies.forEach(dep => {

		//});

		//ctx.dependencies.forEach(dep => {
		//const module = compiledModules.get(dep);
		//if (module)
		//scripts.push(`<script type="module" src="${module?.path}"></script>`);
		//});

		let framework = ``;

		Compiler.frameworkDependencies.forEach(dep => {
			const mod = compiledDependencies.get(dep)!;
			framework += `window.${mod.typeName} = ${mod.source.startsWith("export") ? mod.source.substring(6) : mod.source};\r\n`;
		});

		scripts.push(`<script>${framework}</script>`);

		const mod = compiledDependencies.get(App);

		//if (mod) {
		//	scripts.push(`<script type="module" src="${mod.path}"></script>`);
		//}

		if (mod)
			scripts.push(`<script type="module">import { ${App.name} } from "${mod.path}"; Renderer.render(${App.name});</script>`);

		const html =  `<!DOCTYPE html><html><head><title>${title}</title>${styles.join("")}</head><body>${appHtml}${scripts.join("")}</body></html>`;
	
		return new HtmlRes(html).write(req, res);
	}
}

const parse = async (jsx: JSX.Element, ctx: ContextMap, deps: DependencySet): Promise<string> => {
	if (jsx instanceof Promise)
		jsx = await jsx;

	switch (typeof jsx) {
		case "string":
		case "number":
		case "bigint":
		case "boolean":
			return parsePrimitive(jsx);
		case "object":
			if (jsx === null)
				return "";
			if (typeof jsx.type === "string")
				return parseHtmlElement(jsx, ctx, deps);
			else if (isFragmentElement(jsx))
				return parseFragment(jsx, ctx, deps);
			else
				return parseView(jsx, ctx, deps);
		default:
			if(jsx === undefined) {
				console.warn("Rendered undefined as jsx value!");
				return "";
			}
			throw new Error("Unknown jsx type " + typeof jsx);
	}
};

const isFragmentElement = (value: object): value is JSX.FragmentElement => ((value as any)["type"] === Fragment);

const parsePrimitive = (el: NonNullable<JSX.PrimitiveElement>) => el.toString();

const parseFragment = (el: JSX.FragmentElement, ctx: ContextMap, deps: DependencySet) => Promise.all(el.children.map(el => parse(el, ctx, deps))).then(html => html.join(""));

const parseHtmlElement = async (el: JSX.HtmlElement<keyof JSX.HtmlElements>, ctx: ContextMap, deps: DependencySet): Promise<string> => {
	const childHtml = await Promise.all(el.children.map(el => parse(el, ctx, deps)));
	return `<${el.type}>${childHtml.join("")}</${el.type}>`
};

const parseView = async (el: JSX.ViewElement<any, any>, ctx: ContextMap, deps: DependencySet): Promise<string> => {
	const meta = getClientMeta(el.type);
	meta?.include.forEach((dep) => deps.add(dep));

	const view: View<any> = new el.type(el.props);

	const viewMeta = getViewMeta(el.type);
	if (viewMeta) {
		for (const k in viewMeta.ctxMap) {
			const type = viewMeta.ctxMap[k] as Constructor<Context>;
			const c = ctx.get(type);
			if (!c) {
				throw new Error("Missing context");
			}
			(view as any)[k] = c;
		}
		for (const k in viewMeta.controllerMap) {
			const type = viewMeta.controllerMap[k] as Constructor<Controller>;
			// todo proxy to check which functions got called (check for api signature)
			// todo move this to the core, which should inject services and other classes 
			(view as any)[k] = Controller.create(type);
		}
	}

	if(view instanceof Context) {
		ctx = new Map(ctx);
		ctx.set(el.type as Constructor<Context<any>>, view);	
	}

	await view.load(view.props);
	return parse(view.render(view.props), ctx, deps);
};

export type RenderResult = {
	html: string;
};
