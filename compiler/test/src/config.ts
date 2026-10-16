import { comptime } from "@ion/comptime";

export const config = comptime(() => ({
	debug: true,
	retries: 3,
}));