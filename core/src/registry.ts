import { Err, Ok, type Constructor, type Result } from "@ion/utils";

export class TypeRegistry<T> {
	private readonly set: Set<Constructor<T>> = new Set();

	public readonly register: ClassDecorator = (Class: unknown) => {
		this.set.add(Class as Constructor<T>);
	};

	public readonly all = (): Constructor<T>[] => Array.from(this.set.values());
};

export class Registry<T extends {}> {
	private readonly items: Map<Constructor<T>, T> = new Map();

	public register(item: T): Result<void, Error> {
		const ctor = item.constructor as Constructor<T>;
		if (this.items.has(ctor)) {
			return Err(new Error(`Type ${ctor.name} is already registered!`));
		}
		this.items.set(ctor, item);
		return Ok();
	}

	public get<U extends T>(type: Constructor<U>): U | null {
		if (!this.items.has(type)) {
			return null;
		}
		return this.items.get(type)! as U;
	}

	public all(): readonly T[] {
		return Array.from(this.items.values());
	}
}