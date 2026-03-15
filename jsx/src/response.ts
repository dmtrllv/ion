import type { App } from "@ion/core";
import { Response, type ServerReq, type ServerRes } from "@ion/http";

export class ViewRes extends Response<string> {
	override write(_app: App, _req: ServerReq, res: ServerRes) {
		res.end("TODO: SSR VIEW RENDERING...");
	}
}

export const view = (jsx: any) => new ViewRes("" + jsx);