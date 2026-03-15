import { Api, get } from "@ion/http";
import { User } from "../../models/user.js";
import { repo, Store, store } from "@ion/core";
import { UsersRepo } from "../../repositories/users_repo.js";

export class UsersApi extends Api {
	// use the users repository with buisness/domain logic
	@repo()
	public readonly usersRepo!: UsersRepo;

	// or use the users store directly for simple CRUD
	@store(User)
	public readonly usersStore!: Store<User>;
	
	@get("/api/users")
	public getUsers(): Promise<User[]> {
		return this.usersRepo.getAll();
	}

	@get("/api/users-raw")
	public getUsersRaw(): Promise<User[]> {
		return this.usersStore.getAll();
	}
}