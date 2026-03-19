import { client, controller, List, state, View } from "@ion/jsx";
import { UsersApi } from "../../controllers/api/users.js";
import type { User } from "../../models/user.js";

@client()
export class UserRow extends View<User> {
	override render({ id, username, email }: User) {
		return (
			<div>
				{id?.value || "null"} - {username} - {email}
			</div>
		);
	}
}

@client({
	include: [UserRow, UsersApi]
})
export class UsersPage extends View {
	@controller
	private readonly usersApi!: UsersApi;

	@state
	private users: User[] = [];

	public override async load() {
		this.users = await this.usersApi.getUsers();
	}

	public override render() {
		return (
			<List items={this.users} view={UserRow} />
		);
	}
}