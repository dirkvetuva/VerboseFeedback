"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.white = exports.darkGray = exports.greenBg = exports.redBg = exports.purple = exports.yellow = exports.green = exports.red = exports.black = exports.bold = void 0;
function colorize(colorCode) {
    return (text) => `\u001B[${colorCode}m${text}\u001B[0m`;
}
exports.bold = colorize('1');
exports.black = colorize('30');
exports.red = colorize('31');
exports.green = colorize('32');
exports.yellow = colorize('33');
exports.purple = colorize('35');
exports.redBg = colorize('41');
exports.greenBg = colorize('42');
exports.darkGray = colorize('90');
exports.white = colorize('97');
//# sourceMappingURL=colorize.js.map