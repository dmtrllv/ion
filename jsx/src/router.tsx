import { Context } from "./context.js";
import { jsx } from "./jsx.js";
import { ctx, state, View } from "./view.js";

export class RouterContext extends Context<{ path?: string }> {
	@state
	private readonly path: string;

	public constructor(props: { path?: string }) {
		super(props);
		this.path = props.path || "/";
	}

	public matches(path: string, exact: boolean | undefined) {
		const a = this.path.split("/").filter(s => !!s);
		const b = path.split("/").filter(s => !!s);

		if (exact) {
			if (a.length !== b.length) {
				return false;
			}

			for (let i = 0; i < a.length; i++) {
				let pa = a[i]!;
				let pb = b[i]!;
				if (!pb.startsWith(":") && pa !== pb) {
					return false;
				}
			}
			return true;
		}

		if (b.length > a.length)
			return false;

		for (let i = 0; i < b.length; i++) {
			let pa = a[i]!;
			let pb = b[i]!;
			if (!pb.startsWith(":") && pa !== pb) {
				return false;
			}
		}
		return true;
	}

	public getParams(path: string): Record<string, string> {
		const a = this.path.split("/").filter(s => !!s);
		const b = path.split("/").filter(s => !!s);

		const params: Record<string, string> = {};

		for (let i = 0; i < b.length; i++) {
			let pa = a[i]!;
			let pb = b[i]!;
			if (pb.startsWith(":")) {
				params[pb.substring(1)] = pa;
			}
		}

		return params;
	}
}

export type RouteProps = {
	path: string;
	exact?: boolean;
	view: typeof View<{}>;
}

export class Route extends Context<RouteProps> {
	@ctx
	private readonly ctx!: RouterContext;

	public getParams(): Record<string, string> {
		return this.ctx.getParams(this.props.path);
	}

	public getParam(name: string): string | null {
		const params = this.ctx.getParams(this.props.path);
		if(name in params)
			return params[name]!;
		return null;
	}

	public override render(props: RouteProps) {
		if (this.ctx.matches(props.path, props.exact))
			return jsx(props.view as any);
		return null;
	}
}

export type RedirectProps = {
	from: string;
	exact?: boolean;
	to: string;
}

export class Redirect extends View<RedirectProps> {
	@ctx
	private readonly ctx!: RouterContext;

	public override render(props: RedirectProps) {
		if (this.ctx.matches(props.from, props.exact)) {
			//
		}
		return null;
	}
}