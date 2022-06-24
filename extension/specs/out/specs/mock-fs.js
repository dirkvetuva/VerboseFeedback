"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.injectMockFileSystem = void 0;
const mock = require("mock-fs");
const globals_1 = require("@jest/globals");
function injectMockFileSystem() {
    globals_1.beforeEach(() => {
        mock({
            '.clang_complete': 'text content',
            'tsconfig.json': 'text content',
            // fake EXE for Windows users
            'flexelint.exe': mock.file({
                content: 'I MISS DOS...',
                mode: 0o755
            }),
            // fake binary for non-Windows users
            'flexelint': mock.file({
                content: '#!/usr/bin/env bash\n\nexit 0\n',
                mode: 0o755
            }),
            // fake EXE for Windows users
            'pclp.exe': mock.file({
                content: 'I MISS DOS...',
                mode: 0o755
            }),
            // fake binary for non-Windows users
            'pclp': mock.file({
                content: '#!/usr/bin/env bash\n\nexit 0\n',
                mode: 0o755
            }),
            // fake EXE for Windows users
            'cppcheck.exe': mock.file({
                content: 'I MISS DOS...',
                mode: 0o755
            }),
            // fake binary for non-Windows users
            'cppcheck': mock.file({
                content: '#!/usr/bin/env bash\n\nexit 0\n',
                mode: 0o755
            }),
            // fake EXE for Windows users
            'clang.exe': mock.file({
                content: 'I MISS DOS...',
                mode: 0o755
            }),
            // fake binary for non-Windows users
            'clang': mock.file({
                content: '#!/usr/bin/env bash\n\nexit 0\n',
                mode: 0o755
            }),
            // fake binary for non-Windows users
            'flawfinder': mock.file({
                content: '#!/usr/bin/env bash\n\nexit 0\n',
                mode: 0o755
            }),
            // fake binary for non-Windows users
            'lizard': mock.file({
                content: '#!/usr/bin/env bash\n\nexit 0\n',
                mode: 0o755
            }),
            '.gitignore': mock.file({
                content: 'git ignore content',
                mode: 0o644
            }),
        });
    });
    globals_1.afterEach(() => {
        mock.restore();
    });
}
exports.injectMockFileSystem = injectMockFileSystem;
//# sourceMappingURL=mock-fs.js.map