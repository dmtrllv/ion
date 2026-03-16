import { body, get, Request, route } from "@ion/http";
import { User } from "../../models/user.js";
import { Controller, repo, Store, store } from "@ion/core";
import { UsersRepo } from "../../repositories/users_repo.js";

export class CreateUserReq extends Request {
	public readonly username: string;
	public readonly email: string;
	public readonly password: string

	public constructor(username: string, email: string, password: string) {
		super();
		this.username = username;
		this.email = email;
		this.password = password;
	}
}

@route("/api/users")
export class UsersApi extends Controller {
	// use the users repository with buisness/domain logic
	@repo()
	public readonly usersRepo!: UsersRepo;

	// or use the users store directly for simple CRUD
	@store(User)
	public readonly usersStore!: Store<User>;

	@get("/")
	public getUsers(): Promise<User[]> {
		return this.usersRepo.getAll();
	}

	@get("/raw")
	public getUsersRaw(): Promise<User[]> {
		return this.usersStore.getAll();
	}

	@get("/create")
	public async createUser(@body req: CreateUserReq) {
		console.log(req.username);
	}
}