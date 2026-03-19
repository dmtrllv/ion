import { createHash } from "node:crypto";
import type { Dependency } from "./dependency.js";

export class CompiledModule {
	public source: string;
	public dependencies: Dependency[];
	public hash: string;
	public typeName: string;
	public compiledSource: string;

	public get path() {
		return `/js/${this.typeName.toLowerCase()}_${this.hash}.js`;
	}

	public constructor(type: Dependency, source: string, dependencies: Dependency[]) {
		this.typeName = type.name;
		this.source = source;
		this.compiledSource = source;
		this.dependencies = dependencies;
		this.hash = createHash("md5").update(source).digest("hex");
	}

	public compileWithImports(deps: Map<Dependency, CompiledModule>, importPrefix: string = ""): string {
		this.compiledSource = this.dependencies.map(dep => {
			const m = deps.get(dep);
			if (!m)
				throw new Error(`Could not create import for ${dep.name}`);
			return `import { ${dep.name} } from "${importPrefix}${m.path}";\r\n`;
		}).join("") + this.source;
		return this.compiledSource;
	}
};
