import { Effect } from "./effect.js";
import { Memo } from "./memo.js";
import { Signal } from "./signal.js";

// @internal
export type SlotData = Signal<any> | Effect | Memo<any>;

export type SubScriber = () => any;

// @internal
export class Slot {
	public readonly data: SlotData;
	public readonly subscribers: SubScriber[] = [];

	public constructor(data: SlotData) {
		this.data = data;
	}
}
