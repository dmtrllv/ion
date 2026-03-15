import { Database } from "@ion/db"

import { Pool, type PoolConfig } from "pg";

export type PgOptions = PoolConfig;

export class Pg extends Database {
	public readonly pool: Pool;
	
	public constructor(config: PgOptions) {
		super();
		this.pool = new Pool(config);
	}
}