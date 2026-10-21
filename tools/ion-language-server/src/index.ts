import { createConnection, ProposedFeatures, TextDocuments, DiagnosticSeverity } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";
import { service, updateDocument } from "./server.js";
import ts from "typescript";

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

connection.onInitialize(() => ({
	capabilities: {
		textDocumentSync: 1,
		hoverProvider: true
	}
}));

documents.onDidChangeContent(({ document }) => {
	const fileName = ts.server.toNormalizedPath(URI.parse(document.uri).fsPath);

	updateDocument(fileName, document.version, document.getText());

	const diagnostics = service.getSemanticDiagnostics(fileName).map(diagnostic => ({
		range: {
			start: document.positionAt(diagnostic.start ?? 0),
			end: document.positionAt((diagnostic.start ?? 0) + (diagnostic.length ?? 0))
		},
		message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
		severity: DiagnosticSeverity.Error,
		source: "ion"
	}));

	connection.sendDiagnostics({ uri: document.uri, diagnostics });
});

connection.onHover(({ textDocument, position }) => {
	const fileName = URI.parse(textDocument.uri).fsPath;
	const offset = documents.get(textDocument.uri)?.offsetAt(position);

	if (offset === undefined) 
		return null;

	const info = service.getQuickInfoAtPosition(fileName, offset);
	if (!info) 
		return null;

	return {
		contents: {
			kind: "markdown" as const,
			value: "Hello: " + ts.displayPartsToString(info.displayParts)
		}
	};
});

documents.listen(connection);
connection.listen();