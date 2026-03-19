import type { ViewType } from "../view.js";

export class Renderer {
	private static isRendering: boolean = false;

	public static render = (App: ViewType) => {
		if(this.isRendering) {
			console.log("App is already rendering");
			return;
		}

		this.isRendering = true;
		console.log("render", App);
	}
}