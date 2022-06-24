"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.didFailure = void 0;
const colorize_1 = require("./colorize");
exports.didFailure = false;
function logger(text) {
    text = text.replace(/\n$/, '');
    let message = formatTestHeader(text);
    if (!message) {
        message = formatTestDescription(text);
    }
    if (!message) {
        message = formatTestError(text);
    }
    if (!message) {
        message = formatSnapshotMessage(text);
    }
    if (!message) {
        message = formatTestSummary(text);
    }
    if (process.env.NODE_ENV === 'unknown') {
        return message || text;
    }
    /* eslint-disable no-console */
    console.log(message || text);
    return true;
}
exports.logger = logger;
function formatTestHeader(text) {
    const filepath = text.replace(/^(PASS|FAIL)/, '').trim();
    const [testFilename, ...testPathParts] = filepath.split('/').reverse();
    const testPath = testPathParts.reverse().join('/');
    if (text.startsWith('PASS')) {
        return `${colorize_1.bold(colorize_1.greenBg(colorize_1.black(' PASS ')))} ${colorize_1.darkGray(`${testPath}/`)}${colorize_1.bold(testFilename)}`;
    }
    if (text.startsWith('FAIL')) {
        exports.didFailure = true;
        return `${colorize_1.bold(colorize_1.redBg(colorize_1.black(' FAIL ')))} ${colorize_1.darkGray(`${testPath}/`)}${colorize_1.bold(testFilename)}`;
    }
    return '';
}
function formatTestDescription(text) {
    if (text.includes('✓')) {
        return `  ${colorize_1.green('✓')} ${colorize_1.darkGray(text.replace(/✓/, '').trim())}`;
    }
    if (text.includes('✕')) {
        return `  ${colorize_1.red('✕')} ${colorize_1.darkGray(text.replace(/✕/, '').trim())}`;
    }
    if (text.includes('○')) {
        return `  ${colorize_1.yellow('○')} ${colorize_1.darkGray(text.replace(/○/, '').trim())}`;
    }
    if (text.includes('✎')) {
        return `  ${colorize_1.purple('✎')} ${colorize_1.darkGray(text.replace(/✎/, '').trim())}`;
    }
    return '';
}
function formatTestError(text) {
    return text.includes('●') ? colorize_1.red(text) : '';
}
function formatSnapshotMessage(text) {
    if (text.endsWith('updated.') || text.endsWith('written.') || text.endsWith('removed.')) {
        return colorize_1.bold(colorize_1.green(text));
    }
    if (text.endsWith('obsolete.')) {
        return colorize_1.bold(colorize_1.yellow(text));
    }
    if (text.endsWith('failed.')) {
        return colorize_1.bold(colorize_1.red(text));
    }
    if (text === 'Snapshot Summary') {
        return colorize_1.bold(text);
    }
    if (text.includes('written from')) {
        return formatSnapshotSummary(text, 'written', colorize_1.green);
    }
    if (text.includes('updated from')) {
        return formatSnapshotSummary(text, 'updated', colorize_1.green);
    }
    if (text.includes('removed from')) {
        // Use custom messaging for removed snapshot files
        if (text.includes('file')) {
            const [numSnapshots, numTestSuites] = /(\d)+/.exec(text);
            return ` ${colorize_1.bold(colorize_1.green(`› ${numSnapshots} snapshot ${Number(numSnapshots) > 1 ? 'files' : 'file'} removed`))} from ${numTestSuites} ${Number(numTestSuites) > 1 ? 'test suites' : 'test suite'}.`;
        }
        return formatSnapshotSummary(text, 'removed', colorize_1.green);
    }
    if (text.includes('obsolete from')) {
        return `${formatSnapshotSummary(text, 'obsolete', colorize_1.yellow)} ${colorize_1.darkGray('To remove them all, re-run jest with `JEST_RUNNER_UPDATE_SNAPSHOTS=true`.')}`;
    }
    if (text.includes('↳')) {
        const filepath = text.replace(/↳/, '').trim();
        const [testFilename, ...testPathParts] = filepath.split('/').reverse();
        const testPath = testPathParts.reverse().join('/');
        return `   ↳ ${colorize_1.darkGray(`${testPath}/`)}${colorize_1.bold(testFilename)}`;
    }
    if (text.includes('failed from')) {
        return `${formatSnapshotSummary(text, 'failed', colorize_1.red)} ${colorize_1.darkGray('Inspect your code changes or re-run jest with `JEST_RUNNER_UPDATE_SNAPSHOTS=true` to update them.')}`;
    }
    return '';
}
function formatSnapshotSummary(text, status, colorFunc) {
    const [numSnapshots, numTestSuites] = /(\d)+/.exec(text);
    return ` ${colorize_1.bold(colorFunc(`› ${numSnapshots} ${Number(numSnapshots) > 1 ? 'snapshots' : 'snapshot'} ${status}`))} from ${numTestSuites} ${Number(numTestSuites) > 1 ? 'test suites' : 'test suite'}.`;
}
function formatTestSummary(text) {
    if (!text.includes('\n')) {
        return '';
    }
    const summary = [];
    for (let line of text.split('\n')) {
        if (line.includes('Ran all test suites.')) {
            summary.push(colorize_1.darkGray(line));
            continue;
        }
        if (line.includes('Test Suites:')) {
            line = line.replace('Test Suites:', colorize_1.bold('Test Suites:'));
        }
        if (line.includes('Tests:')) {
            line = line.replace('Tests:', colorize_1.bold('Tests:'));
        }
        if (line.includes('Snapshots:')) {
            line = line.replace('Snapshots:', colorize_1.bold('Snapshots:'));
        }
        if (line.includes('Time:')) {
            line = line.replace('Time:', colorize_1.bold('Time:'));
        }
        if (line.includes('passed')) {
            line = line.replace(/(?<num>\d+) passed/, colorize_1.bold(colorize_1.green('$<num> passed')));
        }
        if (line.includes('updated')) {
            line = line.replace(/(?<num>\d+) updated/, colorize_1.bold(colorize_1.green('$<num> updated')));
        }
        if (line.includes('written')) {
            line = line.replace(/(?<num>\d+) written/, colorize_1.bold(colorize_1.green('$<num> written')));
        }
        if (line.includes('removed')) {
            // Use custom messaging for removed snapshot files
            line = line.replace(/(?<num>\d+) (?<fileText>file|files) removed/, colorize_1.bold(colorize_1.green('$<num> $<fileText> removed')));
            line = line.replace(/(?<num>\d+) removed/, colorize_1.bold(colorize_1.green('$<num> removed')));
        }
        if (line.includes('todo')) {
            line = line.replace(/(?<num>\d+) todo/, colorize_1.bold(colorize_1.purple('$<num> todo')));
        }
        if (line.includes('skipped')) {
            line = line.replace(/(?<num>\d+) skipped/, colorize_1.bold(colorize_1.yellow('$<num> skipped')));
        }
        if (line.includes('obsolete')) {
            line = line.replace(/(?<num>\d+) obsolete/, colorize_1.bold(colorize_1.yellow('$<num> obsolete')));
        }
        if (line.includes('failed')) {
            line = line.replace(/(?<num>\d+) failed/, colorize_1.bold(colorize_1.red('$<num> failed')));
        }
        summary.push(line);
    }
    return summary.join('\n');
}
//# sourceMappingURL=logger.js.map