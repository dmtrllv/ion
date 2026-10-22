import ts from "typescript";
import { Ast } from "./ast.js";
import { cached } from "../utils.js";
import assert from "node:assert";
import { Module } from "./module.js";

export class Import extends Ast<ts.ImportDeclaration> {
	@cached
	public get path() {
		assert.ok(ts.isStringLiteral(this.node.moduleSpecifier));
		return this.node.moduleSpecifier.text;
	}

	@cached
	public get module(): Module {
		
	}
}