"use strict";
/*
 * Original author: Joseph Benden
 * Source: https://github.com/jbenden/vscode-c-cpp-flylint
 *
 * Edited by: Dirk Vet
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCppProperties = void 0;
/* eslint-disable no-console */
const node_1 = require("vscode-languageserver/node");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const vscode_uri_1 = require("vscode-uri");
const fs = require("fs");
const path = require("path");
const tmp = require("tmp");
const _ = require("lodash");
const glob = require("fast-glob");
const settings_1 = require("./settings");
const linter_1 = require("./linters/linter");
const utils_1 = require("./utils");
const clang_1 = require("./linters/clang");
const substituteVariables = require('var-expansion').substituteVariables; // no types available
// Create a connection for the server. The connection uses Node's IPC as a transport.
const connection = node_1.createConnection(new node_1.IPCMessageReader(process), new node_1.IPCMessageWriter(process));
// Create a simple text document manager. The text document manager supports full document sync only.
let documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
// Does the LS client support the configuration abilities?
let hasConfigurationCapability = false;
let defaultSettings;
let globalSettings;
// A mapping between an opened document and its' workspace settings.
let documentSettings = new Map();
// A mapping between an opened document and its' configured analyzers.
let documentLinters = new Map();
// A mapping between an opened document and its' configured analyzers.
let documentVersions = new Map();
var CommandIds;
(function (CommandIds) {
    CommandIds.analyzeActiveDocument = 'verbosefeedback.analyzeActiveDocument';
    CommandIds.analyzeWorkspace = 'verbosefeedback.analyzeWorkspace';
})(CommandIds || (CommandIds = {}));
// Clear the entire contents of TextDocument related caches.
function flushCache() {
    documentLinters.clear();
    documentSettings.clear();
    documentVersions.clear();
}
// After the server has started the client sends an initialize request.
connection.onInitialize((params) => {
    let capabilities = params.capabilities;
    hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
    let result = {
        capabilities: {
            textDocumentSync: {
                openClose: true,
                change: node_1.TextDocumentSyncKind.Full,
                willSaveWaitUntil: false,
                save: {
                    includeText: false
                }
            },
            workspace: {
                workspaceFolders: {
                    supported: true
                }
            },
            executeCommandProvider: {
                commands: [
                    CommandIds.analyzeActiveDocument,
                ]
            }
        }
    };
    return result;
});
connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        connection.client.register(node_1.DidChangeConfigurationNotification.type, undefined);
    }
});
let didStart = false;
let returnFeedback = false;
connection.onDidChangeConfiguration(change => {
    if (hasConfigurationCapability) {
        flushCache();
    }
    else {
        globalSettings = (change.settings['verbosefeedback'] || defaultSettings);
    }
    validateAllDocuments({ force: false });
});
connection.onNotification('begin', (_params) => {
    didStart = true;
    console.log(`Received a notification to enable and start processing.`);
    validateAllDocuments({ force: false });
});
//
connection.onNotification('returnFeedback', (_params) => {
    // Change the boolean value to true or false.
    returnFeedback = !returnFeedback;
    console.log('FEEDBACK MODE = ' + returnFeedback);
    console.log(`Received a notification to enable/disable feedback mode.`);
    validateAllDocuments({ force: true });
});
// NOTE: Does not exist for anything but unit-testing...
connection.onNotification('end', () => {
    didStart = false;
    console.log(`Received a notification to disable and stop processing.`);
});
connection.onNotification('onBuild', async (params) => {
    var _a;
    console.log('Received a notification that a build has completed: ' + _.toString(params));
    let settings = await getDocumentSettings((_a = params.document) !== null && _a !== void 0 ? _a : null);
    const userLintOn = linter_1.toLint(settings['verbosefeedback'].run);
    if (userLintOn !== linter_1.Lint.ON_BUILD) {
        console.log(`Skipping analysis because ${linter_1.fromLint(userLintOn)} !== ON_BUILD.`);
        return;
    }
    validateAllDocuments({ force: false });
});
async function getWorkspaceRoot(resource) {
    const resourceUri = vscode_uri_1.URI.parse(resource);
    const resourceFsPath = resourceUri.fsPath;
    let folders = await connection.workspace.getWorkspaceFolders();
    let result = '';
    if (folders !== null) {
        // sort folders by length, decending.
        folders = folders.sort((a, b) => {
            return a.uri === b.uri ? 0 : (a.uri.length <= b.uri.length ? 1 : -1);
        });
        // look for a matching workspace folder root.
        folders.forEach(f => {
            const folderUri = vscode_uri_1.URI.parse(f.uri);
            const folderFsPath = folderUri.fsPath;
            // does the resource path start with this folder path?
            if (path.normalize(resourceFsPath).startsWith(path.normalize(folderFsPath))) {
                // found the project root for this file.
                result = path.normalize(folderFsPath);
            }
        });
    }
    else {
        // No matching workspace folder, so return the folder the file lives in.
        result = path.dirname(path.normalize(resourceFsPath));
    }
    return result;
}
async function getDocumentSettings(resource) {
    if (!hasConfigurationCapability) {
        return Promise.resolve(globalSettings);
    }
    let result = documentSettings.get(resource);
    if (!result) {
        let workspaceRoot = await getWorkspaceRoot(resource);
        result = connection.workspace.getConfiguration({ scopeUri: resource }).then(s => getMergedSettings(s, workspaceRoot));
        documentSettings.set(resource, result);
    }
    return result;
}
async function reconfigureExtension(currentSettings, workspaceRoot) {
    let linters = []; // clear array
    if (currentSettings['verbosefeedback'].clang.enable) {
        linters.push(await (new clang_1.Clang(currentSettings, workspaceRoot).initialize()));
    }
    _.forEach(linters, (linter) => {
        console.log('A linter is activated.');
        if (linter.isActive() && !linter.isEnabled()) {
            connection.window.showWarningMessage(`Unable to activate ${linter.Name()} analyzer.`);
        }
    });
    return linters;
}
async function getCppProperties(cCppPropertiesPath, currentSettings, workspaceRoot) {
    try {
        if (fs.existsSync(cCppPropertiesPath)) {
            const matchOn = await getActiveConfigurationName(currentSettings);
            const cCppProperties = JSON.parse(fs.readFileSync(cCppPropertiesPath, 'utf8'));
            const platformConfig = cCppProperties.configurations.find(el => el.name === matchOn);
            if (platformConfig !== undefined) {
                // Found a configuration set; populate the currentSettings
                if (platformConfig.includePath.length > 0) {
                    process.env.workspaceRoot = workspaceRoot;
                    process.env.workspaceFolder = workspaceRoot;
                    _.forEach(platformConfig.includePath, (ipath) => {
                        try {
                            let { value } = substituteVariables(ipath, { env: process.env });
                            let globbed_path = glob.sync(value, { cwd: workspaceRoot, dot: false, onlyDirectories: true, unique: true, absolute: true });
                            if (currentSettings['verbosefeedback'].debug) {
                                console.log('Path: ' + ipath + '  VALUE: ' + value + '  Globbed is: ' + globbed_path.toString());
                            }
                            _.each(globbed_path, (gpath) => {
                                var currentFilePath = path.resolve(gpath).replace(/\\/g, '/');
                                if (path.normalize(currentFilePath).startsWith(path.normalize(workspaceRoot))) {
                                    var acceptFile = true;
                                    // see if we are to accept the diagnostics upon this file.
                                    _.each(currentSettings['verbosefeedback'].excludeFromWorkspacePaths, (excludedPath) => {
                                        var substExcludedPath = substituteVariables(excludedPath, { env: process.env, ignoreErrors: true });
                                        var normalizedExcludedPath = path.normalize(substExcludedPath.value || '');
                                        if (currentSettings['verbosefeedback'].debug) {
                                            console.log('Exclude Path: ' + excludedPath + '  VALUE: ' + substExcludedPath.value + '  Normalized: ' + normalizedExcludedPath);
                                        }
                                        if (!path.isAbsolute(normalizedExcludedPath)) {
                                            // prepend the workspace path and renormalize the path.
                                            normalizedExcludedPath = path.normalize(path.join(workspaceRoot, normalizedExcludedPath));
                                        }
                                        // does the document match our excluded path?
                                        if (path.normalize(currentFilePath).startsWith(normalizedExcludedPath)) {
                                            // it did; so do not accept diagnostics from this file.
                                            acceptFile = false;
                                        }
                                    });
                                    if (acceptFile) {
                                        // Windows drive letter must be prefixed with a slash
                                        if (currentFilePath[0] !== '/') {
                                            currentFilePath = '/' + currentFilePath;
                                        }
                                        if (currentSettings['verbosefeedback'].debug) {
                                            console.log('Adding path: ' + currentFilePath);
                                        }
                                        currentSettings['verbosefeedback'].includePaths =
                                            _.uniq(currentSettings['verbosefeedback'].includePaths.concat(currentFilePath));
                                    }
                                }
                                else {
                                    // file is outside of workspace root, perhaps a system folder
                                    // Windows drive letter must be prefixed with a slash
                                    if (currentFilePath[0] !== '/') {
                                        currentFilePath = '/' + currentFilePath;
                                    }
                                    if (currentSettings['verbosefeedback'].debug) {
                                        console.log('Adding system path: ' + currentFilePath);
                                    }
                                    currentSettings['verbosefeedback'].includePaths =
                                        _.uniq(currentSettings['verbosefeedback'].includePaths.concat(currentFilePath));
                                }
                            });
                        }
                        catch (err) {
                            console.error(err);
                        }
                    });
                }
                if (platformConfig.defines.length > 0) {
                    currentSettings['verbosefeedback'].defines =
                        _.uniq(currentSettings['verbosefeedback'].defines.concat(platformConfig.defines));
                }
            }
        }
    }
    catch (err) {
        console.log('Could not find or parse the workspace c_cpp_properties.json file; continuing...');
        console.error(err);
    }
    return currentSettings;
}
exports.getCppProperties = getCppProperties;
async function getActiveConfigurationName(currentSettings) {
    if (currentSettings['verbosefeedback'].debug) {
        console.debug("Proxying request for activeConfigName");
    }
    return utils_1.RobustPromises.retry(40, 250, 1000, () => connection.sendRequest('verbosefeedback.cpptools.activeConfigName')).then(r => {
        if (!_.isArrayLike(r) || r.length === 0)
            return settings_1.propertiesPlatform();
        else
            return r;
    });
}
function getMergedSettings(settings, workspaceRoot) {
    let currentSettings = _.cloneDeep(settings);
    const cCppPropertiesPath = path.join(workspaceRoot, '.vscode', 'c_cpp_properties.json');
    return getCppProperties(cCppPropertiesPath, currentSettings, workspaceRoot);
}
async function getDocumentLinters(resource) {
    const settings = await getDocumentSettings(resource);
    let result = documentLinters.get(resource);
    if (!result) {
        const workspaceRoot = await getWorkspaceRoot(resource);
        result = Promise.resolve(await reconfigureExtension(settings, workspaceRoot));
        documentLinters.set(resource, result);
    }
    return result;
}
// Only keep analyzers and settings for opened documents.
documents.onDidClose(e => {
    documentLinters.delete(e.document.uri);
    documentSettings.delete(e.document.uri);
    documentVersions.delete(e.document.uri);
});
async function onChangedContent(event) {
    if (didStart) {
        // get the settings for the current file.
        let settings = await getDocumentSettings(event.document.uri);
        const userLintOn = linter_1.toLint(settings['verbosefeedback'].run);
        if (userLintOn !== linter_1.Lint.ON_TYPE) {
            console.log(`Skipping analysis because ${linter_1.fromLint(userLintOn)} !== ON_TYPE.`);
            return;
        }
        console.log(`onDidChangeContent starting analysis.`);
        validateTextDocument(event.document, false);
    }
}
// FIXME: 1500 should be a configurable property!
documents.onDidChangeContent(_.debounce(onChangedContent, 1500));
documents.onDidSave(async (event) => {
    // get the settings for the current file.
    let settings = await getDocumentSettings(event.document.uri);
    const userLintOn = linter_1.toLint(settings['verbosefeedback'].run);
    if (userLintOn !== linter_1.Lint.ON_SAVE && userLintOn !== linter_1.Lint.ON_TYPE) {
        console.log(`Skipping analysis because ${linter_1.fromLint(userLintOn)} !== ON_SAVE|ON_TYPE.`);
        return;
    }
    console.log(`onDidSave starting analysis.`);
    validateTextDocument(event.document, false);
});
documents.onDidOpen(async (event) => {
    if (didStart) {
        console.info(`onDidOpen starting analysis.`);
        validateTextDocument(event.document, false);
    }
});
async function validateAllDocuments(options) {
    const { force } = options || {};
    if (didStart) {
        console.log(`validateAllDocuments is starting analysis.`);
        documents.all().forEach(_.bind(validateTextDocument, _, _, force));
    }
}
async function validateTextDocument(textDocument, force) {
    const tracker = new node_1.ErrorMessageTracker();
    const fileUri = vscode_uri_1.URI.parse(textDocument.uri);
    const filePath = fileUri.fsPath;
    const workspaceRoot = await getWorkspaceRoot(textDocument.uri);
    const isTrusted = await connection.sendRequest('isTrusted');
    if (!isTrusted) {
        console.log('Will not analyze an untrusted workspace.');
        return;
    }
    if (workspaceRoot === undefined ||
        workspaceRoot === null ||
        filePath === undefined ||
        filePath === null) {
        // lint can only successfully happen in a workspace, not per-file basis
        console.log('Will not analyze a lone file; must open a folder workspace.');
        return;
    }
    if (fileUri.scheme !== 'file') {
        // lint can only lint files on disk.
        console.log(`Skipping scan of non-local content at ${fileUri.toString()}`);
        return;
    }
    // get the settings for the current file.
    let settings = await getDocumentSettings(textDocument.uri);
    // get the linters for the current file.
    let linters = await getDocumentLinters(textDocument.uri);
    if (linters === undefined || linters === null) {
        // cannot perform lint without active configuration!
        tracker.add(`verbosefeedback: A problem was encountered; the global list of analyzers is null or undefined.`);
        // Send any exceptions encountered during processing to VSCode.
        tracker.sendErrors(connection);
        return;
    }
    // check document version number
    let documentVersion = textDocument.version;
    let lastVersion = documentVersions.get(textDocument.uri);
    if (lastVersion) {
        if (settings['verbosefeedback'].debug) {
            console.log(`${filePath} is currently version number ${documentVersion} and ${lastVersion} was already been scanned.`);
        }
        if (documentVersion <= lastVersion && !force) {
            if (settings['verbosefeedback'].debug) {
                console.log(`Skipping scan of ${filePath} because this file version number ${documentVersion} has already been scanned.`);
            }
            return;
        }
    }
    if (settings['verbosefeedback'].debug) {
        console.log(`${filePath} force = ${force}.`);
        console.log(`${filePath} is now at version number ${documentVersion}.`);
    }
    var tmpDocument = tmp.fileSync();
    fs.writeSync(tmpDocument.fd, textDocument.getText(), 0, 'utf8');
    const documentLines = textDocument.getText().replace(/\r/g, '').split('\n');
    const allDiagnostics = new Map();
    const relativePath = path.relative(workspaceRoot, filePath);
    // deep-copy current items, so mid-stream configuration change doesn't spoil the party
    const lintersCopy = _.cloneDeep(linters);
    console.log(`Performing lint scan of ${filePath}...`);
    var hasSkipLinter = false;
    lintersCopy.forEach(linter => {
        try {
            let result = linter.lint(filePath, workspaceRoot, tmpDocument.name);
            while (result.length > 0) {
                let diagnostics = [];
                let currentFile = '';
                let i = result.length;
                while (i-- >= 0) {
                    var msg = result[i];
                    if (msg === null || msg === undefined || msg.parseError || !msg.hasOwnProperty('line') || msg.source === '') {
                        result.splice(i, 1);
                        continue;
                    }
                    if (currentFile === '') {
                        currentFile = msg.fileName;
                    }
                    if (currentFile !== msg.fileName) {
                        continue;
                    }
                    if (relativePath === msg.fileName || (path.isAbsolute(msg.fileName) && filePath === msg.fileName)) {
                        diagnostics.push(makeDiagnostic(documentLines, msg, textDocument.uri));
                    }
                    else {
                        diagnostics.push(makeDiagnostic(null, msg, textDocument.uri));
                    }
                    result.splice(i, 1);
                }
                diagnostics = _.uniqBy(diagnostics, function (e) { return e.range.start.line + ':::' + e.code + ':::' + e.message; });
                if (allDiagnostics.has(currentFile)) {
                    allDiagnostics.set(currentFile, _.union(allDiagnostics.get(currentFile), diagnostics));
                }
                else {
                    allDiagnostics.set(currentFile, diagnostics);
                }
            }
        }
        catch (e) {
            tracker.add(getErrorMessage(e, textDocument));
        }
    });
    tmpDocument.removeCallback();
    let sendDiagnosticsToEditor = (diagnostics, currentFile) => {
        var currentFilePath = path.resolve(currentFile).replace(/\\/g, '/');
        if (path.normalize(currentFilePath).startsWith(path.normalize(workspaceRoot))) {
            var acceptFile = true;
            // see if we are to accept the diagnostics upon this file.
            _.each(settings['verbosefeedback'].excludeFromWorkspacePaths, (excludedPath) => {
                var normalizedExcludedPath = path.normalize(excludedPath);
                if (!path.isAbsolute(normalizedExcludedPath)) {
                    // prepend the workspace path and renormalize the path.
                    normalizedExcludedPath = path.normalize(path.join(workspaceRoot, normalizedExcludedPath));
                }
                // does the document match our excluded path?
                if (path.normalize(currentFilePath).startsWith(normalizedExcludedPath)) {
                    // it did; so do not accept diagnostics from this file.
                    acceptFile = false;
                }
            });
            if (acceptFile) {
                // Windows drive letter must be prefixed with a slash
                if (currentFilePath[0] !== '/') {
                    currentFilePath = '/' + currentFilePath;
                }
                connection.sendDiagnostics({ uri: 'file://' + currentFilePath, diagnostics: [] });
                if (returnFeedback) {
                    connection.sendDiagnostics({ uri: 'file://' + currentFilePath, diagnostics });
                }
            }
        }
    };
    // Send diagnostics to VSCode
    for (let diagnosticEntry of allDiagnostics) {
        let [fileName, fileDiagnostics] = diagnosticEntry;
        if (returnFeedback) {
            sendDiagnosticsToEditor(fileDiagnostics, fileName.toString());
        }
        else {
            sendDiagnosticsToEditor([], fileName.toString());
        }
    }
    // Remove all previous problem reports, when no further exist
    if (!allDiagnostics.has(relativePath) && !allDiagnostics.has(filePath)) {
        let currentFilePath = path.resolve(filePath).replace(/\\/g, '/');
        // Windows drive letter must be prefixed with a slash
        if (currentFilePath[0] !== '/') {
            currentFilePath = '/' + currentFilePath;
        }
        connection.sendDiagnostics({ uri: 'file://' + currentFilePath, diagnostics: [] });
    }
    console.log('Completed lint scans...');
    if (!hasSkipLinter) {
        documentVersions.set(textDocument.uri, textDocument.version);
    }
    // Send any exceptions encountered during processing to VSCode.
    tracker.sendErrors(connection);
}
/* Extra param ADDED --> uri: The URI string of the active file ????*/
function makeDiagnostic(documentLines, msg, uri) {
    let line;
    if (documentLines !== null) {
        line = _.chain(msg.line)
            .defaultTo(0)
            .clamp(0, documentLines.length - 1)
            .value();
    }
    else {
        line = msg.line;
    }
    // 0 <= n
    let column;
    if (msg.column) {
        column = msg.column;
    }
    else {
        column = 0;
    }
    // Load the diagnostics JSON file.
    const diag_lib = require('../src/error-regex.json');
    let message = '';
    let extra_msg = '';
    let match_found = false;
    if (msg.message) {
        let all_err_type = diag_lib['errors'];
        let length = all_err_type.length;
        for (let i = 0; i < length; i++) {
            let err_type = all_err_type[i];
            /* Check if the error matches one of the regular expressions from
            * the diagnostics library to get the feedback message.
            * If no match is found, only display the original error message.
            */
            let regex = new RegExp(err_type.regex);
            let regex_res = regex.test(msg.message);
            if (regex_res === true) {
                message = `[D]${err_type.phase} ${msg.message}`;
                extra_msg = `${err_type.message}`;
                match_found = true;
                break;
            }
        }
        if (!match_found) {
            message = '[D] ' + msg.message;
        }
    }
    else {
        message = 'Unknown error';
    }
    let code;
    if (msg.code) {
        code = msg.code;
    }
    else {
        code = undefined;
    }
    let source;
    if (msg.source) {
        source = msg.source;
    }
    else {
        source = 'verbosefeedback';
    }
    let startColumn = column;
    let endColumn = column + 1;
    if (documentLines !== null && column === 0 && documentLines.length > 0) {
        let l = _.nth(documentLines, line);
        // Find the line's starting column, sans-white-space
        let lineMatches = l.match(/\S/);
        if (!_.isNull(lineMatches) && _.isNumber(lineMatches.index)) {
            startColumn = lineMatches.index;
        }
        // Set the line's ending column to the full length of line
        endColumn = l.length;
    }
    // Add the translation to the list of related information.
    let relatedInfo = [];
    if (extra_msg.length > 0) {
        relatedInfo = [{
                location: {
                    uri: uri,
                    range: {
                        start: { line: line, character: startColumn },
                        end: { line: line, character: endColumn }
                    }
                },
                message: extra_msg
            }];
    }
    return {
        severity: msg.severity,
        range: {
            start: { line: line, character: startColumn },
            end: { line: line, character: endColumn }
        },
        message: message,
        code: code,
        source: source,
        relatedInformation: relatedInfo
    };
}
function getErrorMessage(err, document) {
    let errorMessage = 'unknown error';
    if (_.isString(err.message)) {
        errorMessage = err.message;
    }
    const fsPathUri = vscode_uri_1.URI.parse(document.uri);
    const message = `vscode-verbosefeedback: '${errorMessage}' while validating: ${fsPathUri.fsPath}. Please analyze the 'verbosefeedback' Output console. Stacktrace: ${err.stack}`;
    return message;
}
connection.onDidChangeWatchedFiles((params) => {
    console.log('FS change notification occurred; re-linting all opened documents.');
    params.changes.forEach(async (element) => {
        let configFilePath = vscode_uri_1.URI.parse(element.uri);
        if (path.basename(configFilePath.fsPath) === 'c_cpp_properties.json') {
            flushCache();
            validateAllDocuments({ force: true });
        }
    });
});
connection.onRequest('getLocalConfig', async (activeDocument) => {
    const tracker = new node_1.ErrorMessageTracker();
    if (activeDocument !== undefined && activeDocument !== null) {
        let fileUri = activeDocument.uri;
        for (const document of documents.all()) {
            try {
                const documentUri = vscode_uri_1.URI.parse(document.uri);
                if (fileUri.fsPath === documentUri.fsPath) {
                    return Promise.resolve((await getDocumentSettings(document.uri))['verbosefeedback']);
                }
            }
            catch (err) {
                tracker.add(getErrorMessage(err, document));
            }
        }
    }
    tracker.sendErrors(connection);
    return Promise.reject();
});
connection.onExecuteCommand((params) => {
    const tracker = new node_1.ErrorMessageTracker();
    if (params.command === CommandIds.analyzeActiveDocument) {
        connection.sendRequest('activeTextDocument')
            .then((activeDocument) => {
            if (activeDocument !== undefined && activeDocument !== null) {
                let fileUri = activeDocument.uri;
                for (const document of documents.all()) {
                    try {
                        const documentUri = vscode_uri_1.URI.parse(document.uri);
                        if (fileUri.fsPath === documentUri.fsPath) {
                            validateTextDocument(document, true);
                        }
                    }
                    catch (err) {
                        tracker.add(getErrorMessage(err, document));
                    }
                }
            }
        });
    }
    else if (params.command === CommandIds.analyzeWorkspace) {
        validateAllDocuments({ force: true });
    }
    tracker.sendErrors(connection);
});
// Make the text document manager listen on the connection for open, change, and close text document events.
documents.listen(connection);
// Listen on the connection.
connection.listen();
//# sourceMappingURL=server.js.map