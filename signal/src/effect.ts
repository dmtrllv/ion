export class Effect {

}

export const effect = (closure: () => void | Promise<void> | EffectCleanupCallback) => {
	closure();
};

export type EffectCleanupCallback = () => void | Promise<void>;