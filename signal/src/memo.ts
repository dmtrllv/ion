export class Memo<_T> {

}

export const memo = <T>(closure: () => T | Promise<T>): Memo<T> => {
	return new Memo()
};