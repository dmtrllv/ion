//import { existsSync } from "node:fs";
//import { readFile, realpath } from "node:fs/promises";
//import { dirname, join, resolve } from "node:path";

//export class Package {
//	private static readonly cache = new Map<string, Promise<Package>>();

//	private static resolveDependency = (root: string, name: string): string => {
//		let current = resolve(root);

//		while (true) {
//			const path = join(current, "node_modules", name);

//			if (existsSync(join(path, "package.json"))) {
//				return path;
//			}

//			const parent = dirname(current);

//			if (parent === current) {
//				throw new Error(
//					`Could not resolve dependency "${name}" from "${root}"`
//				);
//			}

//			current = parent;
//		}
//	};

//	public static readonly load = async (path: string): Promise<Package> => {
//		const root = await realpath(resolve(path));

//		let pending = this.cache.get(root);

//		if (!pending) {
//			pending = readFile(join(root, "package.json"), "utf8").then(text => new Package(root, JSON.parse(text)))

//			this.cache.set(root, pending);

//			pending.catch(() => {
//				if (this.cache.get(root) === pending) {
//					this.cache.delete(root);
//				}
//			});
//		}

//		return pending;
//	};

//	public readonly root: string;
//	public readonly json: PackageJson;

//	private constructor(root: string, pkg: PackageJson) {
//		this.root = root;
//		this.json = pkg;
//	}

//	public async resolveComptimePackages(packages = new Map<string, Package>(), visited = new Set<string>()): Promise<Map<string, Package>> {
//		if (visited.has(this.root)) {
//			return packages;
//		}

//		visited.add(this.root);

//		if (this.usesComptime) {
//			packages.set(this.root, this);
//		}

//		const dependencies = {
//			...this.json.dependencies,
//			...this.json.optionalDependencies
//		};

//		await Promise.all(Object.entries(dependencies).map(async ([name, specifier]) => {
//			let path: string;

//			if (specifier.startsWith("file:")) {
//				path = resolve(this.root, specifier.slice("file:".length));
//			} else {
//				path = Package.resolveDependency(this.root, name);
//			}

//			const pkg = await Package.load(path);
//			await pkg.resolveComptimePackages(packages, visited);
//		}));

//		return packages;
//	}

//	public resolveComptimeConsumers(comptimePackageNames: string[], packages = new Set<ComptimeConsumerPackage>(), visited = new Set<string>()): Set<ComptimeConsumerPackage> {
//		if (visited.has(this.root)) {
//			return packages;
//		}

//		visited.add(this.root);

//		const dependencies = {
//			...this.json.dependencies,
//			...this.json.optionalDependencies
//		};

//		const comptimePackages = Object.keys(dependencies).filter(depName => comptimePackageNames.includes(depName))

//		if (comptimePackageNames.length > 0) {
//			packages.add({ consumer: this, comptimePackages });
//		}

//		return packages;
//	}

//	public get usesComptime(): boolean {
//		return this.json.ion?.comptime === true;
//	}
//}

//export type PackageJson = {
//	name?: string;
//	version?: string;
//	dependencies?: Record<string, string>;
//	devDependencies?: Record<string, string>;
//	optionalDependencies?: Record<string, string>;
//	peerDependencies?: Record<string, string>;
//	ion?: IonPackageConfig;
//};

//export type IonPackageConfig = {
//	comptime?: boolean;
//};

//export type ComptimeConsumerPackage = {
//	consumer: Package;
//	comptimePackages: string[];
//};