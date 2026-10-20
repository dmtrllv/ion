import { comptime } from "@ion/comptime";

export const randomQuote = await comptime(async () => {
	const json = await fetch("https://dummyjson.com/quotes/random").then(r => r.json());
	return json.quote as string;
});

export const mul = comptime.fn((a: number, b: number) => a * b);