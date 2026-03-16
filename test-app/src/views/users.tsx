import { inject, List, View } from "@ion/jsx";
import { UsersApi } from "../controllers/api/users.js";
import type { User } from "../models/user.js";

export class UsersPage extends View {
	@inject(UsersApi)
	public readonly usersApi!: UsersApi;

	override async load() {
		return this.usersApi.getUsers();
	}

	public override render() {
		return (
			<List items={this.state} view={UserRow} />
		);
	}
}

export const UserRow = ({ id, username, email }: User) => (
	<div>
		{id?.value || "null"} - {username} - {email}
	</div>
);