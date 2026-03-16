import { ctx, inject, RouteContext, View } from "@ion/jsx";
import { UsersApi } from "../controllers/api/users.js";
import type { User } from "../models/user.js";

export class UserPage extends View {
	@inject(UsersApi)
	public readonly usersApi!: UsersApi;

	@ctx(RouteContext)
	public routeContext!: RouteContext;

	override async load(): Promise<{ user: User | null }> {
		const id = this.routeContext.getParam("id");
		if (id !== null)
			return { user: await this.usersApi.getUser(Number(id)) };
		return { user: null };
	}

	public override render() {
		if (this.state.user === null) {
			return (
				<h1>No user found!</h1>
			);
		}

		const { username, email } = this.state.user;

		return (
			<>
				<h1>User Page</h1>
				<h3>username: {username}</h3>
				<h3>email: {email}</h3>
			</>
		);
	}
}