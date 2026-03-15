import { column, Model, primary } from "@ion/db";
import { Pg } from "@ion/pg-db";
import { hash } from "bcrypt";

@Pg.register("users")
export class User extends Model {
	@primary
	public readonly id!: number;
	
	@column({ length: 24, unique: true })
	public username!: string;

	@column({ length: 256, unique: true })
	public email!: string;

	@column({ length: 64, onInsert: (value) => hash(value, 10) })
	public password!: string;
}