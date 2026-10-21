import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient/node.js";
import { resolve } from "node:path";

let client: LanguageClient | undefined;

export async function activate(context: vscode.ExtensionContext) {
	const workspace = vscode.workspace.workspaceFolders?.[0];

	if (!workspace) {
		throw new Error("Open a workspace to test the Ion language server.");
	}

	const serverModule = resolve(context.extensionPath, "..", "ion-language-server", "dist", "index.js");

	const serverOptions = {
		command: process.execPath,
		args: [serverModule, "--stdio"],
		options: {
			cwd: workspace.uri.fsPath,
		},
	};

	const clientOptions = {
		documentSelector: [
			{ scheme: "file", language: "typescript" },
		],
	};

	client = new LanguageClient(
		"ionLanguageServer",
		"Ion Language Server",
		serverOptions,
		clientOptions,
	);

	context.subscriptions.push(client);
	await client.start();
}

export async function deactivate() {
	await client?.stop();
}