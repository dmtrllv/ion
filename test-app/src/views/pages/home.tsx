import { client, View } from "@ion/jsx";

@client()
export class HomePage extends View {
	public override render() {
		return (
			<h1>Home</h1>
		);
	}
}