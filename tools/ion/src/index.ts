#!/usr/bin/env node
import { Package } from "@ion/compiler";

const root = Package.get(process.cwd());

console.log(root.dependencies);
console.log(root.devDependencies);
console.log(root.tsconfig);
console.log(root.comptimeManifest);