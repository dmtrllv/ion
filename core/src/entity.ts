type EntityMeta = {
};

export abstract class Entity {
	private static readonly entities: Map<EntityType<any>, EntityMeta> = new Map();

	public static readonly register = (meta: EntityMeta = {}): ClassDecorator => (Class: any) => {
		this.entities.set(Class, meta);
	};

	public static readonly all = () => Array.from(this.entities.entries());
}

export type EntityType<T extends Entity> = new (...args: any) => T;