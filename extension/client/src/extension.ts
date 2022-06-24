/*
 * Original author: Joseph Benden
 * Source: https://github.com/jbenden/vscode-c-cpp-flylint
 *
 * Edited by: Dirk Vet
 */

import * as vscode from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    SettingMonitor,
    TransportKind,
} from 'vscode-languageclient/node';

import * as path from 'path';
import { getFromWorkspaceState, resetWorkspaceState, setWorkspaceState, updateWorkspaceState } from './stateUtils';
import { isBoolean } from 'lodash';


const cp = require('child_process');
const WORKSPACE_IS_TRUSTED_KEY = 'WORKSPACE_IS_TRUSTED_KEY';
const SECURITY_SENSITIVE_CONFIG: string[] = ['clang.executable'];

var IS_TRUSTED: boolean = false;
// Boolean is true if feedback should be returned.
var FEEDBACK_MODE: boolean = false;
// Boolean is true is the GCC compiler has been used.
var GCC_COMPILE: boolean = false;
// Starting position for all errors.
var START_ERR_COL: number = 0;
// End position for all errors.
var END_ERR_COL: number = 80;
// Exit status of the bash 'timeout' command. 124 indicates a timeout.
var TIMEOUT_ERR_CODE: String = '124';

export async function maybeWorkspaceIsTrusted(ctx: vscode.ExtensionContext) {
    if (vscode.workspace.hasOwnProperty('isTrusted') && vscode.workspace.hasOwnProperty('isTrusted') !== null) {
        const workspaceIsTrusted = (vscode.workspace as any)['isTrusted'];
        console.log(`Workspace has property "isTrusted". It has the value of "${workspaceIsTrusted}".`);
        if (isBoolean(workspaceIsTrusted) && workspaceIsTrusted) {
            IS_TRUSTED = true;
            console.log(`Workspace was marked trusted, by user of VSCode.`);
        } else {
            IS_TRUSTED = false;
            console.log(`Workspace is not trusted!`);
        }
        return;
    }

    const isTrusted = getFromWorkspaceState(WORKSPACE_IS_TRUSTED_KEY, false);
    if (isTrusted !== IS_TRUSTED) {
        IS_TRUSTED = true;
    }

    ctx.subscriptions.push(vscode.commands.registerCommand('verbosefeedback.workspace.isTrusted.toggle', async () => {
        await toggleWorkspaceIsTrusted();
        vscode.commands.executeCommand('verbosefeedback.analyzeWorkspace');
    }));
    ctx.subscriptions.push(vscode.commands.registerCommand('verbosefeedback.workspace.resetState', resetWorkspaceState));

    if (isTrusted) {
        return;
    }

    const ignored = ignoredWorkspaceConfig(vscode.workspace.getConfiguration('verbosefeedback'), SECURITY_SENSITIVE_CONFIG);
    if (ignored.length === 0) {
        return;
    }
    const ignoredSettings = ignored.map((x) => `"verbosefeedback.${x}"`).join(',');
    const val = await vscode.window.showWarningMessage(
        `Some workspace/folder-level settings (${ignoredSettings}) from the untrusted workspace are disabled ` +
        'by default. If this workspace is trusted, explicitly enable the workspace/folder-level settings ' +
        'by running the "Verbose Feedback: Toggle Workspace Trust Flag" command.',
        'OK',
        'Trust This Workspace',
        'More Info'
    );
    switch (val) {
        case 'Trust This Workspace':
            await toggleWorkspaceIsTrusted();
            break;
        default:
            break;
    }
}

function ignoredWorkspaceConfig(cfg: vscode.WorkspaceConfiguration, keys: string[]) {
    return keys.filter((key) => {
        const inspect = cfg.inspect(key);
        if (inspect === undefined) {
            return false;
        }
        return inspect.workspaceValue !== undefined || inspect.workspaceFolderValue !== undefined;
    });
}

async function toggleWorkspaceIsTrusted() {
    IS_TRUSTED = !IS_TRUSTED;
    await updateWorkspaceState(WORKSPACE_IS_TRUSTED_KEY, IS_TRUSTED);
}

export async function activate(context: vscode.ExtensionContext) {

    setWorkspaceState(context.workspaceState);

    await maybeWorkspaceIsTrusted(context);

    // The server is implemented in Node.
    const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));

    // The debug options for the server.
    const debugOptions = {
        execArgv: ['--nolazy', '--inspect=6011']
    };

    // If the extension is launched in debug mode the debug server options are used, otherwise the run options are used.
    const serverOptions: ServerOptions = {
        run: {
            module: serverModule,
            transport: TransportKind.ipc
        },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: debugOptions
        }
    };

    // Create the language client and start it.
    startLSClient(serverOptions, context);
}


function startLSClient(serverOptions: ServerOptions, context: vscode.ExtensionContext) {

    // Options to control the language client.
    const clientOptions: LanguageClientOptions = {
        // Register the server for C/C++ documents.
        documentSelector: [{ scheme: 'file', language: 'c' }, { scheme: 'file', language: 'cpp' }],
        synchronize: {
            // Synchronize the setting section "verbosefeedback" to the server.
            configurationSection: 'verbosefeedback',
            fileEvents: vscode.workspace.createFileSystemWatcher('**/.vscode/c_cpp_properties.json')
        }
    };

    const client = new LanguageClient('verbosefeedback', 'verbosefeedback', serverOptions, clientOptions);


    client.onReady()
        .then(() => {

            if (FEEDBACK_MODE) {
                // Disable diagnostics from the C/C++ extension.
                vscode.commands.executeCommand('C_Cpp.DisableErrorSquiggles');
                client.outputChannel.appendLine('Disabling C/C++ error squiggles');
            }
            else {
                // Enable diagnostics from the C/C++ extension.
                vscode.commands.executeCommand('C_Cpp.EnableErrorSquiggles');
                client.outputChannel.appendLine('Enabling C/C++ error squiggles');
            }
            // ----------------------------------------------------------------

            context.subscriptions.push(vscode.commands.registerCommand('verbosefeedback.getLocalConfig', async (d: vscode.TextDocument) => {
                return client.sendRequest('getLocalConfig', d);
            }));

            // ----------------------------------------------------------------

            // Here we must watch for all extension dependencies to start and be ready.
            var untilReadyRetries = 40; // 40x250 = 10 seconds maximum
            const untilReady = async () => {
                client.outputChannel.appendLine(`untilReady: checking...`);


                try {
                    await vscode.commands.executeCommand('cpptools.activeConfigName');
                    client.sendNotification('begin', { document: vscode.window.activeTextEditor!.document });
                }
                catch (err) {
                    client.outputChannel.appendLine(`untilReady: re-arm timer.`);
                    if (--untilReadyRetries > 0) {
                        setTimeout(untilReady, 250); // repeat
                    } else {
                        client.outputChannel.appendLine(`Failed to access "ms-vstools.cpptools"` +
                            `extension's active workspace` +
                            `configuration.`);
                        client.sendNotification('begin');
                    }
                }
            };
            setTimeout(untilReady, 250); // primer

            // ----------------------------------------------------------------

            client.onRequest('activeTextDocument', () => {
                return vscode.window.activeTextEditor!.document;
            });

            // ----------------------------------------------------------------

            client.onRequest('verbosefeedback.cpptools.activeConfigName', async () => {
                client.outputChannel.appendLine(`Sending request to "ms-vstools.cpptools" extension for activeConfigName.`);

                return vscode.commands.executeCommand('cpptools.activeConfigName');
            });

            // ----------------------------------------------------------------

            client.onRequest('isTrusted', () => {
                client.outputChannel.appendLine(`Incoming request for isTrusted property. Have ${IS_TRUSTED}.`);

                return IS_TRUSTED;
            });

            // ----------------------------------------------------------------

            vscode.tasks.onDidEndTask((e: vscode.TaskEndEvent) => {
                if (e.execution.task.group && e.execution.task.group === vscode.TaskGroup.Build) {
                    // send a build notification event
                    let params = {
                        taskName: e.execution.task.name,
                        taskSource: e.execution.task.source,
                        isBackground: e.execution.task.isBackground,
                    };
                    client.sendNotification('onBuild', params);
                }
            });
        });

    let sm = new SettingMonitor(client, 'verbosefeedback.enable');
    context.subscriptions.push(sm.start());
    context.subscriptions.push(new SettingMonitor(client, 'verbosefeedback.enable').start());



    let diag_collection = vscode.languages.createDiagnosticCollection('clang-comp-diagn');
    // The list of all diagnostics to be displayed.
    let all_diagnostics: vscode.Diagnostic[] = [];


    /* Add a diagnostic collection to the list of all diagnostics.
     *
     * msg_str: Error message
     * range_start: Start position of the error.
     * range_stop: End position of the error.
     * severity: The severity level of the diagnostic.
     * add_info: The additional message which will contain the feedback.
     */
    function addDiagnostic(
        msg_str: string,
        range_start: vscode.Position,
        range_stop: vscode.Position,
        severity: vscode.DiagnosticSeverity,
        add_info: vscode.DiagnosticRelatedInformation[]): void {

        // String for the GCC or Clang compiler that has been used.
        let source = GCC_COMPILE ? 'GCC' : 'Clang';

        // Push a diagnostic collection to the list of diagnostics.
        all_diagnostics.push(
            {
                code: '',
                message: msg_str,
                range: new vscode.Range(range_start, range_stop),
                severity: severity,
                source: `[${source}] Verbose Feedback`,
                relatedInformation: add_info
            });
    }

    // Based on: https://github.com/microsoft/vscode-extension-samples/blob/main/diagnostic-related-information-sample/src/extension.ts
    function updateDiagnostics(document: vscode.TextDocument, collection: vscode.DiagnosticCollection): void {
        if (document) {
            collection.set(document.uri, all_diagnostics);
        } else {
            collection.clear();
        }
    }

    /* Parse memory leak errors.
     *
     * stderr: The stderr output
     * file_name: the name of the active file.
     *
     * return: boolean on whether a memory leak has been found and is parsed
     * succesfully.
     */
    function memoryLeak(stderr: String, file_name: string): boolean {
        // Get the memory leak errors separately.
        let all_err = stderr.match(/Direct((.)+\n)*/g);

        if (all_err) {
            try {
                all_err.forEach(err_msg => {
                    // location of the calls to the leak.
                    let err_location = err_msg.match(/#(.*)\n/g);
                    // The coordinates of the origin of the error.
                    let err_root_line = 0;
                    let related_info: vscode.DiagnosticRelatedInformation[] = [];

                    err_location?.forEach(err_loc => {
                        let locFound = err_loc.match(file_name);

                        if (locFound) {
                            // Get the amount of objects that cause leaks.
                            let leaks = err_msg.match(/[0-9]+ object\(s\)/g);

                            let leak_amounts = leaks!.map(str => {
                                return str.split(' ')[0];
                            });
                            let split_err = err_loc.split(' ');
                            // The function in which the error takes place.
                            let err_coordinates = split_err[split_err.length - 1].split(':');
                            let line_num = err_coordinates[1];
                            /* The most recent error rule processed is set as the
                            * root of the error.
                            */
                            err_root_line = parseInt(line_num);
                            let uri = vscode.window.activeTextEditor!.document.uri;
                            let inf_msg = `You have allocated memory, but this memory is not being freed after usage. ${leak_amounts[0]} memory allocation(s) are not being freed, which result in a memory leak.`;

                            let err_range = new vscode.Range(
                                new vscode.Position(parseInt(line_num) - 1,
                                    START_ERR_COL),
                                new vscode.Position(parseInt(line_num) - 1,
                                    END_ERR_COL));

                            related_info.push(new vscode.DiagnosticRelatedInformation(new vscode.Location(uri, err_range),
                                inf_msg));
                        }
                    });

                    /* subtract 1 because compiler returns one-based
                    * indexing, while vscode uses zero-based indexing
                    * for diagnostics.
                    */
                    addDiagnostic('[S][LeakSanitizer]: ' + err_msg,
                        new vscode.Position(err_root_line - 1, START_ERR_COL),
                        new vscode.Position(err_root_line - 1, END_ERR_COL),
                        vscode.DiagnosticSeverity.Error,
                        related_info);
                });
                return true;
            }
            catch {
                /* Return false so that it will be handled later as a
                 * 'possible runtime error'.
                 */
                return false;
            }
        }
        return false;
    }

    /* Parse double free errors.
    *
    * stderr: The stderr output
    * file_name: the name of the active file.
    *
    * return: boolean on whether a double free error has been found and is
    * parsed succesfully.
    */
    function doubleFree(stderr: String, file_name: string): boolean {
        // Get the memory leak errors separately.
        let all_err = stderr.match(/attempting double-free((.)*\n)*/g);

        if (all_err) {
            try {
                all_err.forEach(err_msg => {
                    // Get the first block of the error.
                    let err_block = err_msg.match(/attempting double-free((.)+\n)*/g);
                    // location of the error.
                    let err_location = err_block![0].match(/#(.*)\n/g);
                    // The coordinates of the origin of the error.
                    let err_root_line = 0;
                    let related_info: vscode.DiagnosticRelatedInformation[] = [];

                    err_location?.forEach(err_loc => {
                        let locFound = err_loc.match(file_name);

                        if (locFound) {
                            let split_err = err_loc.split(' ');
                            // The function in which the error takes place.
                            let err_coordinates = split_err[split_err.length - 1].split(':');
                            let line_num = err_coordinates[1];
                            /* The most recent error rule processed is set as the
                            * root of the error.
                            */
                            err_root_line = parseInt(line_num);
                            let uri = vscode.window.activeTextEditor!.document.uri;
                            let inf_msg = 'You are trying to free a block, which already has been freed.';

                            let err_range = new vscode.Range(
                                new vscode.Position(parseInt(line_num) - 1,
                                    START_ERR_COL),
                                new vscode.Position(parseInt(line_num) - 1,
                                    END_ERR_COL));
                            related_info.push(new vscode.DiagnosticRelatedInformation(new vscode.Location(uri, err_range),
                                inf_msg));
                        }

                    });

                    /* subtract 1 because compiler returns one-based
                    * indexing, while vscode uses zero-based indexing
                    * for diagnostics.
                    */
                    addDiagnostic('[S][AdressSanitizer]: ' + err_msg,
                        new vscode.Position(err_root_line - 1,
                            START_ERR_COL),
                        new vscode.Position(err_root_line - 1,
                            END_ERR_COL),
                        vscode.DiagnosticSeverity.Error,
                        related_info);
                });
                return true;
            }
            catch {
                /* Return false so that it will be handled later as a
                 * 'possible runtime error'.
                 */
                return false;
            }
        }
        return false;
    }

    /* Parse heap-use-after-free errors (dangling pointer reference)
     *
     * stderr: The stderr output
     * file_name: the name of the active file.
     *
     * return: boolean on whether a heap-use-after-free error has been found
     * and is parsed succesfully.
     */
    function heapUseAfterFree(stderr: String, file_name: string): boolean {
        // Get the memory leak errors separately.
        let all_err = stderr.match(/heap-use-after-free((.)*\n)*/g);

        if (all_err) {
            try {
                all_err.forEach(err_msg => {
                    // The coordinates of the origin of the error.
                    let err_root_line = 0;
                    // The coordinates of the memory previously being allocated.
                    let root_alloc_line = 0;
                    // The coordinates of the memory previously being freed.
                    let root_free_line = 0;
                    let related_info: vscode.DiagnosticRelatedInformation[] = [];
                    // Get the first block of the error.
                    let err_block = err_msg.match(/heap-use-after-free((.)+\n)*/g);
                    /* Get the block which indicates get the memory previously
                    * being freed.
                    */
                    let free_block = err_msg.match(/freed by thread((.)+\n)*/g);
                    /* Get the block which indicates get the memory previously
                    * being allocated.
                    */
                    let alloc_block = err_msg.match(/previously allocated((.)+\n)*/g);
                    // location of the error.
                    let err_location = err_block![0].match(/#(.*)\n/g);
                    // location of the free instruction.
                    let free_location = free_block![0].match(/#(.*)\n/g);
                    // location of the memory allocation instruction.
                    let alloc_location = alloc_block![0].match(/#(.*)\n/g);
                    // Get the coordinates of the free instruction.
                    free_location?.forEach(free_loc => {
                        let locFound = free_loc.match(file_name);
                        if (locFound) {
                            let split_free = free_loc.split(' ');
                            let free_coordinates = split_free[split_free.length - 1].split(':');
                            let line_num = free_coordinates[1];
                            /* The most recent error rule processed is set as the
                            * root of the error.
                            */
                            root_free_line = parseInt(line_num);
                        }
                    });
                    // Get the coordinates of the memory allocation instruction.
                    alloc_location?.forEach(alloc_loc => {
                        let locFound = alloc_loc.match(file_name);
                        if (locFound) {
                            let split_alloc = alloc_loc.split(' ');
                            let alloc_coordinates = split_alloc[split_alloc.length - 1].split(':');
                            let line_num = alloc_coordinates[1];
                            /* The most recent error rule processed is set as the
                            * root of the error.
                            */
                            root_alloc_line = parseInt(line_num);
                        }
                    });

                    err_location?.forEach(err_loc => {
                        let locFound = err_loc.match(file_name);

                        if (locFound) {
                            let split_err = err_loc.split(' ');
                            // The function in which the error takes place.
                            let err_coordinates = split_err[split_err.length - 1].split(':');
                            let line_num = err_coordinates[1];
                            /* The moest recent error rule processed is set as the
                            * root of the error.
                            */
                            err_root_line = parseInt(line_num);
                            let uri = vscode.window.activeTextEditor!.document.uri;
                            let inf_msg = `You are trying to use memory that you allocated at ${path.basename(file_name)} [Ln ${root_alloc_line}]. You have already freed this memory at ${path.basename(file_name)} [Ln ${root_free_line}], so you cannot access it any longer.`;

                            let err_range = new vscode.Range(
                                new vscode.Position(parseInt(line_num) - 1,
                                    START_ERR_COL),
                                new vscode.Position(parseInt(line_num) - 1,
                                    END_ERR_COL));
                            related_info.push(new vscode.DiagnosticRelatedInformation(new vscode.Location(uri, err_range), inf_msg));
                        }

                    });

                    /* subtract 1 because compiler returns one-based
                    * indexing, while vscode uses zero-based indexing
                    * for diagnostics.
                    */
                    addDiagnostic('[S][AdressSanitizer]: ' + err_msg,
                        new vscode.Position(err_root_line - 1,
                            START_ERR_COL),
                        new vscode.Position(err_root_line - 1,
                            END_ERR_COL),
                        vscode.DiagnosticSeverity.Error,
                        related_info);
                });
                return true;
            }
            catch {
                /* Return false so that it will be handled later as a
                 * 'possible runtime error'.
                 */
                return false;
            }
        }
        return false;
    }

    /* Parse stack-use-after-scope errors
     *
     * stderr: The stderr output
     * file_name: the name of the active file.
     *
     * return: boolean on whether a stack-use-after-scope error has been found
     * and is parsed succesfully.
     */
    function stackUseAfterScope(stderr: String, file_name: string): boolean {
        // Get the memory leak errors separately.
        let all_err = stderr.match(/stack-use-after-scope((.)*\n)*/g);

        if (all_err) {
            try {
                all_err.forEach(err_msg => {
                    let root_stack = err_msg.match(/This frame((.)|\n)*\(line [0-9]*\)/g);
                    let stack_var = root_stack![0].match(/'(.)+'/g);
                    let stack_line_tup = root_stack![0].match(/\(line [0-9]*\)/g);
                    let stack_line = stack_line_tup![0].match(/[0-9]+/g);
                    let stack_msg = `You use stack variable ${stack_var} from [Ln ${stack_line![0]}] outside of its scope. This means the stack variable has exceeded its lifetime, so it cannot be used any longer.`;
                    // The coordinates of the origin of the error.
                    let err_root_line = 0;
                    let related_info: vscode.DiagnosticRelatedInformation[] = [];
                    // Get the first block of the error.
                    let err_block = err_msg.match(/READ((.)+\n)*/g);
                    // location of the error.
                    let err_location = err_block![0].match(/#(.*)\n/g);

                    err_location?.forEach(err_loc => {
                        let locFound = err_loc.match(file_name);

                        if (locFound) {
                            let split_err = err_loc.split(' ');
                            // The function in which the error takes place.
                            let err_coordinates = split_err[split_err.length - 1].split(':');
                            let line_num = err_coordinates[1];
                            /* The moest recent error rule processed is set as the
                            * root of the error.
                            */
                            err_root_line = parseInt(line_num);
                            let uri = vscode.window.activeTextEditor!.document.uri;
                            let inf_msg = stack_msg;
                            // Use the location of the stack variable for the range.
                            let err_range = new vscode.Range(
                                new vscode.Position(parseInt(line_num) - 1,
                                    START_ERR_COL),
                                new vscode.Position(parseInt(line_num) - 1,
                                    END_ERR_COL));

                            related_info.push(new vscode.DiagnosticRelatedInformation(new vscode.Location(uri, err_range), inf_msg));
                        }
                    });

                    /* subtract 1 because compiler returns one-based
                    * indexing, while vscode uses zero-based indexing
                    * for diagnostics.
                    */
                    addDiagnostic('[S][AdressSanitizer]: ' + err_msg,
                        new vscode.Position(err_root_line - 1,
                            START_ERR_COL),
                        new vscode.Position(err_root_line - 1,
                            END_ERR_COL),
                        vscode.DiagnosticSeverity.Error,
                        related_info);
                });
                return true;
            }
            catch {
                /* Return false so that it will be handled later as a
                 * 'possible runtime error'.
                */
                return false;
            }
        }
        return false;
    }

    /* Parse dereference null pointer errors
     *
     * stderr: The stderr output
     * file_name: the name of the active file.
     *
     * return: boolean on whether a dereference null pointer error has been
     * found and is parsed succesfully.
     */
    function dereferenceNull(stderr: String, file_name: string): boolean {
        // Get the dereference errors separately.
        let all_err = stderr.match(/SEGV on unknown address 0x000000000000((.)*\n)*/g);

        if (all_err) {
            try {
                all_err.forEach(err_msg => {
                    // location of the calls to the leak.
                    let err_location = err_msg.match(/#(.*)\n/g);
                    // The coordinates of the origin of the error.
                    let err_root_line = 0;
                    let related_info: vscode.DiagnosticRelatedInformation[] = [];

                    err_location?.forEach(err_loc => {
                        let locFound = err_loc.match(file_name);

                        if (locFound) {

                            let split_err = err_loc.split(' ');
                            // The function in which the error takes place.
                            let err_coordinates = split_err[split_err.length - 1].split(':');
                            let line_num = err_coordinates[1];
                            /* The most recent error rule processed is set as the
                            * root of the error.
                            */
                            err_root_line = parseInt(line_num);

                            let uri = vscode.window.activeTextEditor!.document.uri;
                            let inf_msg = `You are trying to dereference a pointer, which points to NULL. This will lead to unpredicted behaviour.`;

                            let err_range = new vscode.Range(
                                new vscode.Position(parseInt(line_num) - 1,
                                    START_ERR_COL),
                                new vscode.Position(parseInt(line_num) - 1,
                                    END_ERR_COL));

                            related_info.push(new vscode.DiagnosticRelatedInformation(new vscode.Location(uri, err_range), inf_msg));
                        }

                    });

                    /* subtract 1 because compiler returns one-based
                    * indexing, while vscode uses zero-based indexing
                    * for diagnostics.
                    */
                    addDiagnostic('[S][AddressSanitizer]: ' + err_msg,
                        new vscode.Position(err_root_line - 1, START_ERR_COL),
                        new vscode.Position(err_root_line - 1, END_ERR_COL),
                        vscode.DiagnosticSeverity.Error,
                        related_info);
                });
                return true;
            }
            catch {
                /* Return false so that it will be handled later as a
                 * 'possible runtime error'.
                 */
                return false;
            }
        }
        return false;
    }

    /* Parse stack-buffer-overflow errors.
     *
     * stderr: The stderr output
     * file_name: the name of the active file.
     *
     * return: boolean on whether a stack-buffer-overflow error has been found
     * and is parsed succesfully.
     */
    function stackBufferOverflow(stderr: String, file_name: string): boolean {
        // Get the memory leak errors separately.
        let all_err = stderr.match(/stack-buffer-overflow((.)*\n)*/g);

        if (all_err) {
            try {
                all_err.forEach(err_msg => {
                    // The coordinates of the origin of the error.
                    let err_root_line = 0;
                    let related_info: vscode.DiagnosticRelatedInformation[] = [];
                    // Get the first block of the error.
                    let err_block = err_msg.match(/stack-buffer-overflow on address((.)+\n)*/g);
                    // location of the error.
                    let err_location = err_block![0].match(/#(.*)\n/g);

                    err_location?.forEach(err_loc => {
                        let locFound = err_loc.match(file_name);

                        if (locFound) {
                            let split_err = err_loc.split(' ');
                            // The function in which the error takes place.
                            let err_coordinates = split_err[split_err.length - 1].split(':');
                            let line_num = err_coordinates[1];
                            /* The most recent error rule processed is set as the
                            * root of the error.
                            */
                            err_root_line = parseInt(line_num);
                            let uri = vscode.window.activeTextEditor!.document.uri;
                            let inf_msg = `You are trying to store an object that is larger than the size of the destination buffer.`;

                            let err_range = new vscode.Range(
                                new vscode.Position(parseInt(line_num) - 1,
                                    START_ERR_COL),
                                new vscode.Position(parseInt(line_num) - 1,
                                    END_ERR_COL));
                            related_info.push(new vscode.DiagnosticRelatedInformation(new vscode.Location(uri, err_range), inf_msg));
                        }
                    });

                    /* subtract 1 because compiler returns one-based
                    * indexing, while vscode uses zero-based indexing
                    * for diagnostics.
                    */
                    addDiagnostic('[S][AdressSanitizer]: ' + err_msg,
                        new vscode.Position(err_root_line - 1, START_ERR_COL),
                        new vscode.Position(err_root_line - 1, END_ERR_COL),
                        vscode.DiagnosticSeverity.Error,
                        related_info);

                });
                return true;
            }
            catch (err) {
                /* Return false so that it will be handled later as a
                 * 'possible runtime error'.
                 */
                return false;
            }
        }
        return false;
    }


    /* Return runtime errors from the GCC compiler.
     */
    let runtimeGCC = vscode.commands.registerCommand('verbosefeedback.gccRuntimeDocument', function () {
        vscode.window.showInformationMessage('Executing GCC Runtime error command...(timeout after 30s)');

        let file = vscode.window.activeTextEditor!.document.fileName;
        GCC_COMPILE = true;

        /* Compile with GCC and include all the .c files in the current
         * directory.
         */
        let cmd_comp = `gcc -fsanitize=address -g ${path.parse(file).dir}/*.c -o ${path.parse(file).name}`;
        let cmd_run = `timeout 30s ./${path.parse(file).name} || echo $? 1>&2`;
        cp.exec(cmd_comp, (err: Error, stdout: String, stderr: String) => {

            all_diagnostics = [];
            diag_collection.clear();
            console.log('cmd_comp stdout: ' + stdout);
            console.log('cmd_comp stderr: ' + stderr);

            // GCC compilation failed
            if (err) {
                updateDiagnostics(vscode.window.activeTextEditor!.document,
                    diag_collection);
                vscode.window.showErrorMessage('GCC compile/link error');
            }
            else {
                /* Run the program and terminate after 30s if necessary. Then
                 * read the exit status.
                 */
                cp.exec(cmd_run, (err: Error, stdout: String, stderr: String) => {

                    console.log('cmd_run stdout: ' + stdout);
                    console.log('cmd_run stderr: ' + stderr);

                    if (stderr) {
                        let trim_stderr = stderr.trim();
                        // The original error without the error code at the end.
                        let orig_err = trim_stderr.substring(0, trim_stderr.lastIndexOf('\n'));

                        /* Check if the error code '124' from the timeout
                         * command is found at the end of the string.
                         */
                        if (trim_stderr.length >= 3 && trim_stderr.substring(trim_stderr.length - 3, trim_stderr.length) === TIMEOUT_ERR_CODE) {

                            diag_collection.clear();
                            updateDiagnostics(vscode.window.activeTextEditor!.document,
                                diag_collection);
                            vscode.window.showErrorMessage('Execution ended prematurely. Takes longer than 30s. Infinite while loop may be present.');
                            return;
                        }
                        /* A runtime error occurred. Parse the runtime errors
                         * from stderr.
                         */
                        if (err || stderr) {

                            let mem_leak = memoryLeak(orig_err, file);
                            let double_free = doubleFree(orig_err, file);
                            let heap_use = heapUseAfterFree(orig_err, file);
                            let stack_use = stackUseAfterScope(orig_err, file);
                            let deref_null = dereferenceNull(orig_err, file);
                            let stack_buf = stackBufferOverflow(orig_err, file);

                            /* If an error is found and recognized as a runtime
                             * error, show an error message.
                            */
                            if (mem_leak || double_free || heap_use || stack_use || deref_null || stack_buf) {
                                updateDiagnostics(vscode.window.activeTextEditor!.document,
                                    diag_collection);
                                vscode.window.showErrorMessage('GCC runtime error');
                            }
                            else {
                                /* A possible runtime error is found, but it is
                                 * not covered by the extension.
                                 * Use position (0,0) as it is not sure if the
                                 * error message is a true error or a print
                                 * statement of the program to stderr.
                                 */
                                console.log("orig " + orig_err + "\nstd " + stderr);
                                addDiagnostic('[S]' + orig_err,
                                    new vscode.Position(0, 0),
                                    new vscode.Position(0, 0),
                                    vscode.DiagnosticSeverity.Error,
                                    []);

                                updateDiagnostics(vscode.window.activeTextEditor!.document,
                                    diag_collection);
                                vscode.window.showInformationMessage('GCC possible runtime error. Look in your error message for the correct location.');
                            }
                        }
                    }
                    else {
                        /* Succesfull compilation without errors.
                         * stderr is empty, so no errors found.
                         */
                        diag_collection.clear();
                        updateDiagnostics(vscode.window.activeTextEditor!.document,
                            diag_collection);
                        vscode.window.showInformationMessage('Success! No GCC runtime errors.!');
                    }
                });
            }
        });
    });
    context.subscriptions.push(runtimeGCC);


    /* Return compile/linking errors from the GCC compiler.
     */
    let compileGCC = vscode.commands.registerCommand('verbosefeedback.gccCompileDocument', function () {
        vscode.window.showInformationMessage('Executing GCC Compile/Link error command');

        let file = vscode.window.activeTextEditor!.document.fileName;
        GCC_COMPILE = true;

        /* Compile with GCC and include all the .c files in the current
         * directory.
         */
        let cmd_comp = `gcc -fsanitize=address -g ${path.parse(file).dir}/*.c -o ${path.parse(file).name}`;

        cp.exec(cmd_comp, (err: Error, stdout: String, stderr: String) => {

            all_diagnostics = [];
            diag_collection.clear();
            console.log('cmd_comp stdout: ' + stdout);
            console.log('cmd_comp stderr: ' + stderr);

            // GCC compilation/linking failed
            if (err || stderr) {
                // Linking error found.
                if (stderr.includes('error: ld')) {
                    /* Use position (0, 0) as it is not sure if the link error
                     * contains an error location.
                     */
                    addDiagnostic('[S][Linking phase] ' + stderr,
                        new vscode.Position(0, 0),
                        new vscode.Position(0, 0),
                        vscode.DiagnosticSeverity.Error,
                        []
                    );
                    updateDiagnostics(vscode.window.activeTextEditor!.document, diag_collection);
                    vscode.window.showErrorMessage('GCC linking error');
                }
                // Compile error found.
                else {
                    addDiagnostic('[S][Compile phase] ' + stderr,
                        new vscode.Position(0, 0),
                        new vscode.Position(0, 0),
                        vscode.DiagnosticSeverity.Error,
                        []
                    );
                    updateDiagnostics(vscode.window.activeTextEditor!.document, diag_collection);
                    vscode.window.showErrorMessage('GCC compile error');
                }
            }
            else {
                updateDiagnostics(vscode.window.activeTextEditor!.document, diag_collection);
                vscode.window.showInformationMessage('GCC compile/link successfull!');
            }
        });
    });
    context.subscriptions.push(compileGCC);


    /* Return compile/linking errors from the Clang compiler.
     */
    let compileClang = vscode.commands.registerCommand('verbosefeedback.clangCompileDocument', function () {
        vscode.window.showInformationMessage('Executing Clang Compile/Link error command');

        let file = vscode.window.activeTextEditor!.document.fileName;
        GCC_COMPILE = false;

        /* Compile with clang and include all the .c files in the current
         * directory.
         */
        let cmd_comp = `clang -fsanitize=address -g ${path.parse(file).dir}/*.c -o ${path.parse(file).name}`;

        cp.exec(cmd_comp, (err: Error, stdout: String, stderr: String) => {

            all_diagnostics = []; 
            diag_collection.clear();
            console.log('cmd_comp stdout: ' + stdout);
            console.log('cmd_comp stderr: ' + stderr);

            // Clang compilation/linking failed
            if (err || stderr) {
                // Linking error found.
                if (stderr.includes('error: linker')) {
                    /* Use position (0, 0) as it is not sure if the link error
                     * contains an error location.
                     */
                    addDiagnostic('[S][Linking phase] ' + stderr,
                        new vscode.Position(0, 0),
                        new vscode.Position(0, 0),
                        vscode.DiagnosticSeverity.Error,
                        []
                    );
                    updateDiagnostics(vscode.window.activeTextEditor!.document, diag_collection);
                    vscode.window.showErrorMessage('Clang linking error');
                }
                // Compile error found.
                else {
                    addDiagnostic('[S][Compile phase] ' + stderr,
                        new vscode.Position(0, 0),
                        new vscode.Position(0, 0),
                        vscode.DiagnosticSeverity.Error,
                        []
                    );
                    updateDiagnostics(vscode.window.activeTextEditor!.document, diag_collection);
                    vscode.window.showErrorMessage('Clang compile error');
                }
            }
            else {
                updateDiagnostics(vscode.window.activeTextEditor!.document, diag_collection);
                vscode.window.showInformationMessage('Clang compile/link successfull!');
            }
        });
    });
    context.subscriptions.push(compileClang);


    /* Return runtime errors from the Clang compiler.
     */
    let runtimeClang = vscode.commands.registerCommand('verbosefeedback.clangRuntimeDocument', function () {
        vscode.window.showInformationMessage('Executing Clang Runtime error command...(timeout after 30s)');

        let file = vscode.window.activeTextEditor!.document.fileName;

        GCC_COMPILE = false;

        /* Compile with GCC and include all the .c files in the current
         * directory.
         */
        let cmd_comp = `clang -fsanitize=address -g ${path.parse(file).dir}/*.c -o ${path.parse(file).name}`;
        let cmd_run = `timeout 30s ./${path.parse(file).name} || echo $? 1>&2`;
        cp.exec(cmd_comp, (err: Error, stdout: String, stderr: String) => {

            all_diagnostics = [];
            diag_collection.clear();
            console.log('cmd_comp stdout: ' + stdout);
            console.log('cmd_comp stderr: ' + stderr);

            // GCC compilation failed
            if (err) {
                updateDiagnostics(vscode.window.activeTextEditor!.document, diag_collection);
                vscode.window.showErrorMessage('Clang compile/link error');
            }
            else {
                /* Run the program and terminate after 30s if necessary. Then
                 * read the exit status.
                 */
                cp.exec(cmd_run, (err: Error, stdout: String, stderr: String) => {

                    console.log('cmd_run stdout: ' + stdout);
                    console.log('cmd_run stderr: ' + stderr);

                    if (stderr) {
                        let trim_stderr = stderr.trim();
                        // The original error without the error code at the end.
                        let orig_err = trim_stderr.substring(0, trim_stderr.lastIndexOf('\n'));
                        console.log(orig_err);
                        console.log('error code =', trim_stderr.substring(trim_stderr.length - 3, trim_stderr.length));

                        /* Check if the error code '124' from the timeout
                         * command is found at the end of the string.
                         */
                        if (trim_stderr.length >= 3 && trim_stderr.substring(trim_stderr.length - 3, trim_stderr.length) === TIMEOUT_ERR_CODE) {

                            diag_collection.clear();
                            updateDiagnostics(vscode.window.activeTextEditor!.document,
                                diag_collection);
                            vscode.window.showErrorMessage('Execution ended prematurely. Takes longer than 30s. Infinite while loop may be present.');
                            return;
                        }
                        /* A runtime error occurred. Parse the runtime errors
                         * from stderr.
                         */
                        if (err || stderr) {

                            let mem_leak = memoryLeak(orig_err, file);
                            let double_free = doubleFree(orig_err, file);
                            let heap_use = heapUseAfterFree(orig_err, file);
                            let stack_use = stackUseAfterScope(orig_err, file);
                            let deref_null = dereferenceNull(orig_err, file);
                            let stack_buf = stackBufferOverflow(orig_err, file);

                            /* If an error is found and recognized as a
                             * runtime error, show an error message.
                             */
                            if (mem_leak || double_free || heap_use || stack_use || deref_null || stack_buf) {
                                updateDiagnostics(vscode.window.activeTextEditor!.document,
                                    diag_collection);
                                vscode.window.showErrorMessage('Clang runtime error');
                            }
                            else {
                                /* A possible runtime error is found, but it is
                                 * not covered by the extension.
                                 * Use position (0,0) as it is not sure if the
                                 * error message is a true error or a print
                                 * statement of the program to stderr.
                                 */
                                addDiagnostic(orig_err,
                                    new vscode.Position(0, 0),
                                    new vscode.Position(0, 0),
                                    vscode.DiagnosticSeverity.Error,
                                    []
                                );

                                updateDiagnostics(vscode.window.activeTextEditor!.document,
                                    diag_collection);
                                vscode.window.showInformationMessage('Clang possible runtime error. Look in your error message for the correct location.');
                            }
                        }
                    }
                    else {
                        /* Succesfull compilation without errors.
                         * stderr is empty, so no errors found.
                         */
                        diag_collection.clear();
                        updateDiagnostics(vscode.window.activeTextEditor!.document,
                            diag_collection);
                        vscode.window.showInformationMessage('Success! No Clang runtime errors.');
                    }
                });
            }
        });
    });
    context.subscriptions.push(runtimeClang);


    /* Switch between error messages from the Microsoft C/C++ extension and
     * the error messages with feedback from Verbose Feedback.
     */
    let feedbackClang = vscode.commands.registerCommand('verbosefeedback.feedbackClangCompiler', function () {

        if (FEEDBACK_MODE === false) {
            FEEDBACK_MODE = true;
            GCC_COMPILE = false;

            // Show the errors in the diagnostics window.
            updateDiagnostics(vscode.window.activeTextEditor!.document,
                diag_collection);
            client.sendNotification('returnFeedback', { document: vscode.window.activeTextEditor!.document });

            // Disable diagnostics from the C/C++ extension.
            vscode.commands.executeCommand('C_Cpp.DisableErrorSquiggles');
            client.outputChannel.appendLine('Disabling C/C++ error squiggles');
        }
        else {
            FEEDBACK_MODE = false;
            GCC_COMPILE = true;

            // Empty the diagnostic window.
            all_diagnostics = [];
            updateDiagnostics(vscode.window.activeTextEditor!.document, diag_collection);
            client.sendNotification('returnFeedback', { document: vscode.window.activeTextEditor!.document });

            // Enable diagnostics from the C/C++ extension.
            vscode.commands.executeCommand('C_Cpp.EnableErrorSquiggles');
            client.outputChannel.appendLine('Enabling C/C++ error squiggles');
        }

        let onOff = FEEDBACK_MODE ? 'ON' : 'OFF';
        vscode.window.showInformationMessage(`Clang compiler with feedback swtiched ${onOff}`);

    });
    context.subscriptions.push(feedbackClang);


    // Run the program by using the Microsoft C/C++ extension.
    let runFile = vscode.commands.registerCommand('verbosefeedback.buildFile', function () {
        vscode.window.showInformationMessage('Compiling/running the file');
        vscode.commands.executeCommand('C_Cpp.BuildAndRunFile');
        client.outputChannel.appendLine('Running a file.');
    });
    context.subscriptions.push(runFile);

    // Clear all errors by reloading the window.
    let clearErrors = vscode.commands.registerCommand('verbosefeedback.clearErrors', function () {
        vscode.window.showInformationMessage('Clearing all errors by reloading the window.');
        all_diagnostics = [];
        updateDiagnostics(vscode.window.activeTextEditor!.document, diag_collection);
        client.outputChannel.appendLine('Reloading the window.');
        vscode.commands.executeCommand("workbench.action.reloadWindow");
    });
    context.subscriptions.push(clearErrors);
}



