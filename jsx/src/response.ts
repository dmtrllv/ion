import { Response, type ServerReq, type ServerRes } from "@ion/http";
import type { View } from "./view.js";
import type { Constructor } from "@ion/utils";

export class ViewRes extends Response<string> {
	override write(_req: ServerReq, res: ServerRes) {
		res.end("TODO: SSR VIEW RENDERING...");
	}
}

export const view = (jsx: JSX.Element | Constructor<View> | JSX.FC) => new ViewRes("" + jsx);