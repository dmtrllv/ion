import { Repository, Store, store, type ID, type Query } from "@ion/core";
import { User } from "../models/user.js";

// TODO: auto generate
export class UsersRepo extends Repository<User> {
	@store(User)
	public readonly usersStore!: Store<User>;

	public override get(id: ID<User>): Promise<User | null> {
		this.usersStore.get(id);
		throw new Error("Method not implemented.");
	}

	public override getAll(): Promise<User[]> {
		throw new Error("Method not implemented.");
	}

	public override save(_entity: User): Promise<void> {
		throw new Error("Method not implemented.");
	}

	public override delete(_id: ID<User>): Promise<void> {
		throw new Error("Method not implemented.");
	}

	override query(_filter: Query<User> | Query<User>[]): Promise<void> {
		throw new Error("Method not implemented.");
	}
}