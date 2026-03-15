import { repo, Repository } from "@ion/core";
import { get, Api, html } from "@ion/http";
import { User } from "../models/user.js";

export class UsersRoute extends Api {
	@repo(User)
	public readonly usersStore!: Repository<User>; // TODO: if no repository for User exists generate one
	
	@get("/users")
	public async viewUsers() {
		const users = await this.usersStore.getAll();
		return html("<h1>hi!</h1>" + users?.map(user => `<div>${user.username}</div>`));
	}
}