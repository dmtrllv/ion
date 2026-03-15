//import { StaticRegistry } from "./container.js";
//import type { MaybePromise } from "@ion/utils";

//type Primitive = string | number | boolean;

//type ConfigObject = {
//	readonly [K: string]: ConfigData;
//};

//type ConfigArray = readonly ConfigData[];

//type ConfigData = Primitive | ConfigObject | ConfigArray | Config<any>;

//export abstract class Config<T extends ConfigObject> extends StaticRegistry {
//	//private static readonly _types: typeof Config<any>[] = [];

//	//public static readonly register = <T extends typeof Config<any>>() => (Class: T) => {
//	//	this._types.push(Class);
//	//}

//	//public static readonly getTypes = (): readonly (typeof Config<any>)[] => Config._types;

//	private _isConfigured: boolean = false;
//	private _data?: T;

//	public get isConfigured(): boolean { return this._isConfigured; }

//	public async configure(): Promise<void> {
//		this._data = await this.onConfigure();
//		this._isConfigured = true;
//	}

//	protected abstract onConfigure(): MaybePromise<T>;

//	public get<K extends keyof T>(key: K, defaultValue?: T[K]): T[K];
//	public get<K extends keyof T>(key: K, ...defaultValue: any[]): T[K] {
//		if (!this.isConfigured)
//			throw new Error(`${this.constructor.name} is not configured yet!`);

//		if (key in this._data!) {
//			return this._data![key];
//		}

//		if (defaultValue.length === 0)
//			throw new Error(`Missing configuration key ${key.toString()} for ${this.constructor.name}!`)

//		return defaultValue[0]!;
//	}
//}

//export type ConfigureContext = {
//	readonly use: (...types: (typeof Config<any>)[]) => void;
//}