# Ion

## Features: 
- http routing with params
- base classes for value types, entities, services, controllers, stores, mappers etc
- auto mapper and database store management (with decorators)
- asset management (loading, parsing and serving resources on the file system)
- front-end html library that renders html from jsx and creates front-end js scripts. It also has 2 way state binding.
- global and controller based error middleware and handling.
- automatically validate  



## Example
```tsx
class User extends Model {
	@primary()
	public readonly id!: number;

	@column("varchar(32)", { unique: true })
	public username!: string;

	@column("varchar(256)", { unique: true })
	public email!: string;

	@column("varchar(60)", { onInsert: (p): Promise<string> => bcrypt.hash(p) })
	public password!: string;
}

class GetUserReq implements Validatable {
	@required
	@min(4)
	@max(32)
	readonly username!: string;
};

class UsersApi extends Api {
	@store(User)
  	private readonly users!: Store<User>;

	@get("/api/user")
	public getUser(@body req: GetUserReq): Promise<User | null> {
		return this.users.findOne({ where: { username: req.username } });
	}

	@get("/api/users")
	public getUsers(): Promise<User[]> {
		return this.users.all();
	}

}

class UsersRoute extends Controller {
	@get("/users")
	public viewUsers(): Promise<JSX.Element> {
		return view(Users);
	}
}

@View.client({
	styles: ["styles/users-list.css"]
})
class Users extends View {
	@api(UsersApi)
	private readonly usersApi: UsersApi;
	
	public async render(): Promise<JSX.Element> {
		const users = await this.usersApi.getUsers();
		return (
			<div class="users-list">
				<List items={users} view={UserRow} />
			</div>
		);
	}
}

type UserRowProps = Pick<User, "id" | "username" | "email">;

const UserRow = ({ id, username, email }: UserRowProps) => (
	<div>
		{id} - {username} - {email} 
	</div>
);

```