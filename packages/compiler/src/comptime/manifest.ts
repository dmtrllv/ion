import { ComptimeType } from "./item.js"

export type ComptimeManifest = {
	exports: {
		[path: string]: {
			[ident: string]: ComptimeType;
		};
	};
};