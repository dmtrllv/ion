import { get, param } from "@ion/http";
import { jsx, view } from "@ion/jsx";
import { Controller } from "@ion/core";
import { UserPage } from "../views/user.js";

export class Route extends Controller {
	@get("/:id")
	public async viewUser(@param(":id") id: number) {
		return view(jsx(UserPage, { id }));
	}
}