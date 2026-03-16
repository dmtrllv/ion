import { Route, Redirect, View } from "@ion/jsx"
import { HomePage } from "./home.js";
import { UsersPage } from "./users.js";
import { UserPage } from "./user.js";

export class App extends View {
	override render() {
		return (
			<>
				<h1>Hello Ion JSX App :D</h1>
				<Redirect from="/" exact to="/home" />
				<Route path="/home" exact view={HomePage} />
				<Route path="/users" exact view={UsersPage} />
				<Route path="/users/:id" exact view={UserPage} />
			</>
		);
	}
};