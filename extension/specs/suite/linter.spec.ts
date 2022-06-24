import { cloneDeep } from 'lodash';
import { basename } from 'path';
import { Clang } from '../../server/src/linters/clang';
import { Linter } from '../../server/src/linters/linter';
import { Settings } from '../../server/src/settings';
import { defaultConfig } from '../mock-config';
import { injectMockFileSystem } from '../mock-fs';

describe('Analyser executables', () => {
    injectMockFileSystem();

    var config: Settings;
    var linter: Linter;

    describe.each([
        {
            formal_name: 'Clang',
            binary_name: 'clang',
            claz: (c: Settings, p: string) => { return new Clang(c, p); }
        }
    ])('.analyser($formal_name, $binary_name)', ({ formal_name, binary_name, claz }) => {

        beforeEach(() => {
            config = cloneDeep(defaultConfig);
            linter = claz(config, process.cwd());
        });

        test(`should find the actual ${formal_name} executable`, async () => {
            await linter['maybeEnable']();

            // access private member variable via JavaScript property access.
            const exe = basename(linter['executable']);

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
                .catch((e: Error) => {
                    expect(e.message).toEqual(`The executable was not found for ${formal_name}, disabling linter`);
                });
        });
    });
});
