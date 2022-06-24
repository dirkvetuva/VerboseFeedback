"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const mock_fs_1 = require("../mock-fs");
const SUBJECT = '.gitignore';
const EXPECTED = 'git ignore content';
describe('mock file-system', () => {
    mock_fs_1.injectMockFileSystem();
    test('has specific file on disk', () => {
        const data = fs.statSync(SUBJECT);
        expect(data.isFile()).toBeTruthy();
    });
    test('has known content in specific file', () => {
        const data = fs.readFileSync(SUBJECT, 'utf8');
        expect(data).toBe(EXPECTED);
    });
});
describe('real file-system', () => {
    test('has specific file on disk', () => {
        const data = fs.statSync(SUBJECT);
        expect(data.isFile()).toBeTruthy();
    });
    test('has unknown content in specific file', () => {
        const data = fs.readFileSync(SUBJECT, 'utf8');
        expect(data).not.toBe(EXPECTED);
    });
});
//# sourceMappingURL=setup-vfs.spec.js.map