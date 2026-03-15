import { Registry } from "./registry.js";

export abstract class Mapper<Domain, Persistence> {
	private static readonly registry = new Registry<Mapper<any, any>>();

	public static readonly register = this.registry.register;
	public static readonly all = this.registry.all;

	public abstract toDomain(raw: Persistence): Domain;
	public abstract toPersistence(entity: Domain): Persistence;
}