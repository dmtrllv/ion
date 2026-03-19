import { client, controller, ctx, Route, state, View } from "@ion/jsx";
import { UsersApi } from "../../controllers/api/users.js";
import type { User } from "../../models/user.js";

@client({
	include: [UsersApi]
})
export class UserPage extends View {
	@controller
	private readonly usersApi!: UsersApi;

	@ctx
	private readonly route!: Route;

	@state
	private user: User | null = null;

	override async load() {
		const id = this.route.getParam("id");
		if (id !== null) {
			const data = await this.usersApi.getUser(Number(id));
			this.user = data;
		}
	}

	public override render() {
		if (this.user === null) {
			return (
				<h1>No user found!</h1>
			);
		}

		const { username, email } = this.user;

		return (
			<>
				<h1>User Page</h1>
				<h3>username: {username}</h3>
				<h3>email: {email}</h3>
			</>
		);
	}
}