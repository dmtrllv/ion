import { Controller, get, param, route } from "@ion/http";
import { view } from "@ion/jsx";
import { Users } from "../views/users.js";

@route("/users")
export class UsersRoute extends Controller {
	@get()
	public async viewUsers() {
		return view(123);
	}

	@get("/:id")
	public async viewUser(@param id: number) {
		return view(Users);
	}
}