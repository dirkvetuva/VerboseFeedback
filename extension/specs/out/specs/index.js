"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = void 0;
const path = require("path");
const jest_cli_1 = require("jest-cli");
const logger_1 = require("./debug-console/logger");
const rootDir = path.resolve(process.cwd(), '.');
async function run() {
    //process.stdout.write = (text: string) => !!logger(text);
    process.stderr.write = (text) => !!logger_1.logger(text);
    let args = [];
    if (process.env.JEST_ARGS) {
        args = JSON.parse(process.env.JEST_ARGS);
    }
    args.push('--runInBand', '--useStderr', '--env=vscode', '--colors', '--watchman=false', `--roots=${rootDir}`, `--setupFilesAfterEnv=${path.resolve(__dirname, './setup.js')}`);
    await jest_cli_1.run(args, rootDir);
    if (logger_1.didFailure)
        process.exit(1);
}
exports.run = run;
//# sourceMappingURL=index.js.map