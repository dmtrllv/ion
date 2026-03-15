import { api, List, View } from "@ion/jsx";
import { UsersApi } from "../routes/api/users.js";
import type { User } from "../models/user.js";

export class Users extends View {
	@api(UsersApi)
	public readonly usersApi!: UsersApi;

	public override async load() {
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
		{id} - {username} - {email}
	</div>
);