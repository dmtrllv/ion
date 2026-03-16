import { get, param } from "@ion/http";
import { jsx, view } from "@ion/jsx";
import { Controller } from "@ion/core";
import { UserPage } from "../views/user.js";
import { App } from "../views/app.js";

export class Route extends Controller {
	@get("/")
	public async view() {
		return view(jsx(App, {}));
	}

	@get("/:id")
	public async viewUser(@param(":id") id: number) {
		if(isNaN(id)) {
			return view(jsx(App, {}));
		}
		return view(jsx(UserPage, { id }));
	}
}