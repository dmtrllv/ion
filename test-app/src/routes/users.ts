import { get, param, route } from "@ion/http";
import { jsx, view } from "@ion/jsx";
import { UserRow } from "../views/users.js";
import { Controller } from "@ion/core";

@route("/users")
export class UsersRoute extends Controller {
	@get("/")
	public async viewUsers() {
		return view(123);
	}

	@get("/:id")
	public async viewUser(@param(":id") id: number) {
		console.log(id)
		return view(jsx(UserRow));
	}
}