import { API, formatDiagnosticsWithColorAndContext, type Diagnostic } from "typescript/sync";


export class Compiler {
	readonly #api = new API();

	public constructor() {
		
	}
}

const reportErrors = (diagnostics: readonly Diagnostic[]) => {
    console.log(formatDiagnosticsWithColorAndContext(diagnostics, api))
};

// Parse command-line filenames and compiler options, report any errors.
const commandLineArgs = process.argv.slice(2);
const parsedCommandLine = api.parseCommandLine(commandLineArgs);
if (parsedCommandLine.errors.length > 0) {
    reportErrors(parsedCommandLine.errors);
    process.exit();
}

const config = api.parseJsonConfigFileContent("", { configDirectory: "" });
config.options
// Create the program by resolving and parsing all files in the entry point.
using program = api.createProgram(parsedCommandLine.fileNames, parsedCommandLine.options);
using program2 = api.createProgram()
//// Collect and report any diagnostics from the program before emitting.
//// You can customize whether any of these block reporting errors in subsequent passes if desired.
//const diagnostics = [
//    ...program.getGlobalDiagnostics(),
//    ...program.getProgramDiagnostics(),
//    ...program.getSyntacticDiagnostics(),
//    ...program.getSemanticDiagnostics(),
//];
//if (diagnostics.length > 0) {
//    reportErrors(diagnostics);
//}

//// Emit files - this respects the `noEmitOnError` option,
//// so nothing will be emitted if an earlier step reported errors.
//const emitResult = program.emit();
//if (emitResult.diagnostics.length > 0) {
//    reportErrors(emitResult.diagnostics);
//}