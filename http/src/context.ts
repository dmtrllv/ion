export type HttpContext<T = unknown> = {
	readonly params: Record<string, string>;
	readonly query: Record<string, string>;
	readonly headers: Record<string, string>;
	readonly body?: T;

	request: unknown;
	response: unknown;
};
