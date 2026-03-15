import { App, Plugin } from "@ion/core";
import type { MaybePromise } from "@ion/utils";
import { Pg, type PgOptions } from "./db.js";
//import { Database } from "@ion/db";

export class PgPlugin extends Plugin<PgOptions> {
	override install(_app: App): MaybePromise<void> {
		console.log(Pg);
		//app.registerStore();
	}
}

export const pg = (options: PgOptions = {}) => new PgPlugin(options);