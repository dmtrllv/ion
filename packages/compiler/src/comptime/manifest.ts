import { resolve, sep } from "node:path";
import { Compiler } from "../compiler.js";
import { ComptimeType } from "./item.js"
import assert from "node:assert";
import { Module } from "../module.js";
import ts from "typescript";
import { isNodeBuiltinModule } from "../utils.js";
import { Package } from "../package.js";
import { writeFileSync } from "node:fs";

export type ComptimeManifest = {
	exports: {
		[path: string]: CopmtimeModuleExports;
	};
};

export type CopmtimeModuleExports = {
	[ident: string]: ComptimeType;
};

export const createComptimeManifest = (compiler: Compiler) => {
	const manifestPath = resolve(compiler.rootPackage.path, "comptime.manifest.json");
	const manifest: ComptimeManifest = { exports: {} };
	compiler.program.getRootFileNames().forEach(path => {
		const module = compiler.modules.get(path);
		assert.ok(module);
		const relativePath = path.replace(module.package.sourcePath + sep, "");
		const exports = resolveComptimeExports(compiler, module);
		if (exports)
			manifest.exports[relativePath] = exports;
	});

	writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
}

const resolveComptimeExports = (compiler: Compiler, module: Module): CopmtimeModuleExports | undefined => {
	const exports: CopmtimeModuleExports = {};
	for (const stmt of module.sourceFile.statements) {
		if (ts.isExportDeclaration(stmt)) {
			if (stmt.exportClause) {
				if (ts.isNamedExports(stmt.exportClause)) {
					for (const element of stmt.exportClause.elements) {
						const name = element.propertyName?.text || element.name.text;
						const symbol = compiler.typeChecker.getSymbolAtLocation(element.name);
						assert.ok(symbol);
						const comptimeDecl = compiler.comptimeResolver.resolveDeclaration(symbol);
						if (comptimeDecl)
							exports[name] = comptimeDecl.type;
					}
				} else if (ts.isNamespaceExport(stmt.exportClause)) {
					const aliasName = stmt.exportClause.name.text;
					const importPath = stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier) ? stmt.moduleSpecifier.text : undefined;
					assert.ok(importPath);

					if (importPath === "@ion/comptime") {
						console.log(`Cannot re-export from @ion/comptime!`);
						continue;
					}

					if (isNodeBuiltinModule(importPath))
						continue;

					const resolved = ts.resolveModuleName(importPath, module.path, compiler.config.options, ts.sys).resolvedModule;
					assert.ok(resolved);
					const pkg = Package.fromModulePath(resolved.resolvedFileName);
					assert.ok(pkg);

					if (compiler.isRootPackage(pkg)) {
						if (!stmt.exportClause) {
							const importedSourceFile = compiler.program.getSourceFile(resolved.resolvedFileName);
							assert.ok(importedSourceFile);
							const importedModuleSymbol = compiler.typeChecker.getSymbolAtLocation(importedSourceFile);
							assert.ok(importedModuleSymbol);
							const exportedSymbols = compiler.typeChecker.getExportsOfModule(importedModuleSymbol);
							if (exportedSymbols.find(e => !!compiler.comptimeResolver.resolveDeclaration(e))) {
								exports[aliasName] = "value";
							}
						}
					} else if (pkg.isComptime) {
						if (!stmt.exportClause) {
							const relativeSourcePath = resolved.resolvedFileName.replace(pkg.sourcePath + sep, "");
							const pkgExports = pkg.comptimeManifest?.exports[relativeSourcePath];
							if (pkgExports) {
								exports[aliasName] = "value";
							}

						}
					}
				}
			} else if (stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)) {
				const importPath = stmt.moduleSpecifier.text;
				if (importPath === "@ion/comptime") {
					console.log(`Cannot re-export from @ion/comptime!`);
					continue;
				}

				if (isNodeBuiltinModule(importPath))
					continue;

				const resolved = ts.resolveModuleName(importPath, module.path, compiler.config.options, ts.sys).resolvedModule;
				assert.ok(resolved);
				const pkg = Package.fromModulePath(resolved.resolvedFileName);
				assert.ok(pkg);

				if (compiler.isRootPackage(pkg)) {
					if (!stmt.exportClause) {
						const importedSourceFile = compiler.program.getSourceFile(resolved.resolvedFileName);
						assert.ok(importedSourceFile);
						const importedModuleSymbol = compiler.typeChecker.getSymbolAtLocation(importedSourceFile);
						assert.ok(importedModuleSymbol);
						const exportedSymbols = compiler.typeChecker.getExportsOfModule(importedModuleSymbol);
						exportedSymbols.forEach(e => {
							const decl = compiler.comptimeResolver.resolveDeclaration(e);
							if (decl)
								exports[e.name] = decl.type;
						});
					}
				} else if (pkg.isComptime) {
					if (!stmt.exportClause) {
						const relativeSourcePath = resolved.resolvedFileName.replace(pkg.sourcePath, "");
						const pkgExports = pkg.comptimeManifest?.exports[relativeSourcePath] || {};
						Object.assign(exports, pkgExports);
					}
				}
			}
		} else if (ts.isExportAssignment(stmt)) {
			const comptimeExpr = compiler.comptimeResolver.resolveExpr(stmt.expression);
			if (comptimeExpr) {
				exports["default"] = comptimeExpr.type;
			}
		} else if (ts.isVariableStatement(stmt)) {
			if (stmt.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
				for (const decl of stmt.declarationList.declarations) {
					const comptimeDecl = compiler.comptimeResolver.resolveVarDeclaration(decl);
					if (comptimeDecl) {
						exports[decl.name.getText()] = comptimeDecl.type;
					}
				}
			}

		}
	}
	return exports;
}