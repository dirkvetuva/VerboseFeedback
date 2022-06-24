"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const vscode = require("vscode");
const settings_1 = require("../../server/src/settings");
const utils_1 = require("../../server/src/utils");
// ------------------------------  Critical  -------------------------------
// One CANNOT test across IPC channels to the server, as the test is NOT the
// same Node.js process!
// ------------------------------  Critical  -------------------------------
// ------------------------------  Critical  -------------------------------
// VSCode's idea of settings are not ment for run-time calculated settings,
// as if it were used in this manner, these values would be persisted to
// the actual settings store.
// ------------------------------  Critical  -------------------------------
const currentDir = __dirname;
jest.setTimeout(300000);
describe('c_cpp_properties.json unit-tests', () => {
    test('should find the fixture file', () => {
        var propertiesData = JSON.parse(fs_1.readFileSync(path_1.resolve(currentDir, './fixtures/c_cpp_properties.json'), 'utf8'));
        const config = propertiesData.configurations.find(el => el.name === settings_1.propertiesPlatform());
        expect(config).toBeDefined();
        expect(config).toHaveProperty('includePath');
    });
    describe('GIVEN an opened workspace', () => {
        const workspaceFolder = path_1.resolve(currentDir, './fixtures/c_cpp_properties');
        const filePath = path_1.resolve(workspaceFolder, 'c_cpp_properties.c');
        var document;
        beforeAll(async () => {
            await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(workspaceFolder));
            document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
            await vscode.window.showTextDocument(document);
        });
        afterAll(async () => {
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        });
        test.todo('it should handle plain includePaths setting');
        test.todo('it should handle non-existing includePaths setting');
        test('it should handle glob expansion of includePaths setting', async () => {
            // WHEN
            let config = (await utils_1.RobustPromises.retry(42, // # of attempts
            1000, // delay between retries
            1000, // timeout for a try
            () => vscode.commands.executeCommand('verbosefeedback.getLocalConfig', document)));
            // THEN: simple checks against the set of includePaths
            expect(config).toBeDefined();
            expect(config.includePaths.length).toBeGreaterThan(2);
            // and then: no glob sequences are in the set of all includePaths
            expect(config.includePaths).not.toEqual(expect.arrayContaining([
                expect.stringMatching(/\/\*\*/),
            ]));
            // and then: a known set of directories are in the set of all includePaths
            expect(config.includePaths).toEqual(expect.arrayContaining([
                expect.stringMatching(/\/a\/aa$/),
                expect.stringMatching(/\/b\/aa$/),
                expect.stringMatching(/\/c\/aa$/),
                expect.stringMatching(/\/c\/bb$/)
            ]));
        });
    });
});
//# sourceMappingURL=unit-c_cpp_properties.spec.js.map