import { body, get, param, Request, route } from "@ion/http";
import { Controller, createId, service } from "@ion/core";
import { User } from "../../models/user.js";
import { UsersService } from "../../services/users.js";

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
	@service()
	public readonly service!: UsersService;
	
	@get("/")
	public getUsers(): Promise<User[]> {
		return this.service.getAllUsers();
	}

	@get("/:id")
	public getUser(@param("id") id: number): Promise<User | null> {
		return this.service.getUser(createId(User, id));
	}

	@get("/create")
	public async createUser(@body req: CreateUserReq) {
		this.service.createUser(req.username, req.email, req.password);
	}
}