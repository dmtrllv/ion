import { comptime } from "@ion/comptime";

// this will be executed at compiletime
// randomQuote will contain just a string after compilation
const randomQuote = await comptime(async () => {
	const response = await fetch("https://dummyjson.com/quotes/random");
	const json = await response.json();
	return json.quote as string;
});

// this function can also be called at compile time
const mul = comptime.fn((a: number, b: number) => a * b);

// like here const two will just contain the value 2
const two = mul(1, 2);

console.log(randomQuote);
console.log(two);