
import * as ts from "typescript";
import { resolve } from "node:path";

const root = process.cwd();
const configPath = ts.findConfigFile(root, ts.sys.fileExists, "tsconfig.json");

if (!configPath) throw new Error("Could not find tsconfig.json");

const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));

const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, resolve(configPath, ".."));
const options = parsed.options;

const openDocuments = new Map<string, { version: number; text: string }>();

export function updateDocument(fileName: string, version: number, text: string) {
	openDocuments.set(ts.server.toNormalizedPath(fileName), { version, text });
}

const host: ts.LanguageServiceHost = {
	getCompilationSettings() { return options; },
	getScriptFileNames() {
		return parsed.fileNames;
	},
	getScriptVersion(fileName) {
		return String(openDocuments.get(ts.server.toNormalizedPath(fileName))?.version ?? 0);
	},
	getScriptSnapshot(fileName) {
		const normalized = ts.server.toNormalizedPath(fileName);
		const openDocument = openDocuments.get(normalized);

		if (openDocument) {
			return ts.ScriptSnapshot.fromString(openDocument.text);
		}

		const content = ts.sys.readFile(fileName);
		return content ? ts.ScriptSnapshot.fromString(content) : undefined;
	},
	getCurrentDirectory() { return root; },
	getDefaultLibFileName(options) { return ts.getDefaultLibFilePath(options); },
	readFile(fileName) { return ts.sys.readFile(fileName); },
	fileExists(fileName) { return ts.sys.fileExists(fileName); },
	resolveModuleNameLiterals(moduleLiterals, containingFile, redirectedReference, options, _containingSourceFile, _reusedNames) {
		return moduleLiterals.map(moduleLiteral => {
			const result = ts.resolveModuleName(
				moduleLiteral.text,
				containingFile,
				options,
				ts.sys,
				undefined,
				redirectedReference,
			);

			return result;
		});
	}
};

export const service = ts.createLanguageService(host);
