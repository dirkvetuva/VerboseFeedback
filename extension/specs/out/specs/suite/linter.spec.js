"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = require("lodash");
const path_1 = require("path");
const clang_1 = require("../../server/src/linters/clang");
const mock_config_1 = require("../mock-config");
const mock_fs_1 = require("../mock-fs");
describe('Analyser executables', () => {
    mock_fs_1.injectMockFileSystem();
    var config;
    var linter;
    describe.each([
        {
            formal_name: 'Clang',
            binary_name: 'clang',
            claz: (c, p) => { return new clang_1.Clang(c, p); }
        }
    ])('.analyser($formal_name, $binary_name)', ({ formal_name, binary_name, claz }) => {
        beforeEach(() => {
            config = lodash_1.cloneDeep(mock_config_1.defaultConfig);
            linter = claz(config, process.cwd());
        });
        test(`should find the actual ${formal_name} executable`, async () => {
            await linter['maybeEnable']();
            // access private member variable via JavaScript property access.
            const exe = path_1.basename(linter['executable']);
            expect(linter.isActive()).toBeTruthy();
            expect(exe).toBe(binary_name);
        });
        test(`should NOT find a missing ${formal_name} executable`, async () => {
            // GIVEN
            linter['setExecutable']('non-existent');
            // WHEN
            await linter['maybeEnable']()
                // THEN
                .then(() => {
                fail(new Error('Should not have gotten a result value'));
            })
                .catch((e) => {
                expect(e.message).toEqual(`The executable was not found for ${formal_name}, disabling linter`);
            });
        });
    });
});
//# sourceMappingURL=linter.spec.js.map