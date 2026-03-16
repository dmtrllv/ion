export class Context {

}

export const ctx = <T extends typeof Context>(_type: T): PropertyDecorator => () => {

}