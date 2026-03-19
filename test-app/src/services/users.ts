import { repository, Service, type ID } from "@ion/core";
import { UsersRepo } from "../repositories/users_repo.js";
import { User } from "../models/user.js";
import { Err, Ok, type Result } from "@ion/utils";

export class UsersService extends Service {
	@repository
	private readonly users?: UsersRepo;

	public async createUser(username: string, email: string, password: string): Promise<Result<void, Error>> {
		const users = await this.users?.query([{ username }, { email }]);
		if (users && users.length > 0) {
			return Err(new Error(`username or email already taken!`));
		}

		await this.users?.save({
			username,
			email,
			password
		});

		return Ok();
	}

	public async getUser(id: ID<User>): Promise<User | null> {
		return this.users ? this.users.get(id) : {
			username: "test",
			email: "test",
			password: ""
		};
	}

	public async getAllUsers(): Promise<User[]> {
		return this.users?.getAll() || [];
	}

	public async removeUser() { }
}