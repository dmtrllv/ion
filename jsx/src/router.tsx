import { Context } from "./context.js";
import { View } from "./view.js";

export type RouteProps = {
	path: string;
	exact?: boolean;
	view: typeof View<{}>;
}

export class Route extends View<RouteProps> {
	public override render(_props: RouteProps) {
		return null;
	}
}

export type RedirectProps = {
	from: string;
	exact?: boolean;
	to: string;
}

export class Redirect extends View<RedirectProps> {
	public override render(_props: RedirectProps) {
		return null;
	}
}

export class RouteContext extends Context {
	public getParam(_name: string): string | null {
		return null;
	}
}