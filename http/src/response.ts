import type { ServerReq, ServerRes } from "./server.js";

export abstract class Response<T> {
	public readonly value: T;
	public constructor(value: T) {
		this.value = value;
	}
	public abstract write(req: ServerReq, res: ServerRes): any | Promise<any>;
}

export class JsonRes<T extends object | any[] | null> extends Response<T> {
	public write(_req: ServerReq, res: ServerRes) {
		return new Promise<void>((resolve, reject) => {
			const str = JSON.stringify(this.value);

			res.setHeader("Content-Type", "application/json");
			res.setHeader("Content-Length", str.length);
			res.write(str, (err) => {
				if(err)
					return reject(err);
				res.end(resolve);
			});
		})
	}
}

export class HtmlRes extends Response<string> {
	public write(_req: ServerReq, res: ServerRes) {
		return new Promise<void>((resolve, reject) => {
			res.setHeader("Content-Type", "text/html");
			res.setHeader("Content-Length", this.value.length);
			res.write(this.value, (err) => {
				if(err)
					return reject(err);
				res.end(resolve);
			});
		})
	}
}

export class TextRes extends Response<string> {
	public write(_req: ServerReq, res: ServerRes) {
		return new Promise<void>((resolve, reject) => {
			res.setHeader("Content-Type", "text/plain");
			res.setHeader("Content-Length", this.value.length);
			res.write(this.value, (err) => {
				if(err)
					return reject(err);
				res.end(resolve);
			});
		})
	}
}

export class RedirectRes extends Response<string> {
	public write(_req: ServerReq, res: ServerRes) {
		return new Promise<void>((resolve) => {
			res.statusCode = 302;
			res.setHeader("location", this.value);
			res.end(resolve);
		})
	}
}

export const html = (html: string) => new HtmlRes(html);
export const json = <T extends object | any[] | null>(json: T) => new JsonRes<T>(json);
export const text = (text: string) => new TextRes(text);
export const redirect = (path: string) => new RedirectRes(path);
