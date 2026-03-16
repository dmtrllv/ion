import { App, Plugin } from "@ion/core";
import type { MaybePromise } from "@ion/utils";
import { type PgOptions } from "./db.js";

export class PgPlugin extends Plugin<PgOptions> {
	override install(_app: App): MaybePromise<void> {
		console.log("Todo install PgPlugin");
	}
}

export const pg = (options: PgOptions = {}) => new PgPlugin(options);