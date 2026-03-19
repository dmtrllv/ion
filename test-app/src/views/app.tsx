import { Route, Redirect, View, client } from "@ion/jsx";
import { HomePage, UserPage, UsersPage } from "./pages/index.js";

@client({
	include: [HomePage, UserPage, UsersPage]
})
export class App extends View {
	public override render() {
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