import * as path from 'path';
import * as _ from 'lodash';
import { ClangSeverityMaps, Settings, VS_DiagnosticSeverity } from '../settings';
import { Linter, Lint } from './linter';
import { InternalDiagnostic } from '../server';
import { DiagnosticSeverity } from 'vscode-languageserver/node';

export class Clang extends Linter {
    private actualFileName: string = '';
    private tmpFileName: string = '';

    constructor(settings: Settings, workspaceRoot: string) {
        super('Clang', settings, workspaceRoot, false);
        this.cascadeCommonSettings('clang');

        this.executable = settings['verbosefeedback'].clang.executable;
        this.configFile = settings['verbosefeedback'].clang.configFile;
        this.active = this.enabled = settings['verbosefeedback'].clang.enable;
    }

    public lintOn(): Lint[] {
        return [Lint.ON_SAVE, Lint.ON_TYPE, Lint.ON_BUILD];
    }

    protected buildCommandLine(fileName: string, tmpFileName: string): string[] {
        let includePathParams = this.getIncludePathParams();
        let languageParam = this.getLanguageParam();
        let iquoteParams: string[];

        if (this.settings['verbosefeedback'].run === 'onType') {
            iquoteParams = this.expandedArgsFor(
                '-iquote',
                false,
                [path.dirname(fileName)].concat(this.includePaths),
                null
            );
        } else {
            iquoteParams = [];
        }

        let pedanticParams = this.getPedanticParams();
        let msExtensions = this.settings['verbosefeedback'].clang.msExtensions ?
            ['-fms-extensions'] : [];
        let noExceptions = this.settings['verbosefeedback'].clang.noExceptions ?
            ['-fno-exceptions'] : [];
        let noRtti = this.settings['verbosefeedback'].clang.noRtti ?
            ['-fno-rtti'] : [];
        let blocks = this.settings['verbosefeedback'].clang.blocks ?
            ['-fblocks'] : [];
        let includeArgParams = this.expandedArgsFor(
            '-include',
            false,
            this.settings['verbosefeedback'].clang.includes,
            null);
        let warningsParams = this.expandedArgsFor(
            '-W',
            true,
            this.settings['verbosefeedback'].clang.warnings,
            null);
        let standardParams = this.expandedArgsFor(
            '--std=',
            true,
            this.standard,
            ['c11', 'c++11']);
        let standardLibParams = this.expandedArgsFor(
            '--stdlib=',
            true,
            this.settings['verbosefeedback'].clang.standardLibs,
            null);
        let defineParams = this.expandedArgsFor(
            '-D',
            true,
            this.defines,
            null);
        let undefineParams = this.expandedArgsFor(
            '-U',
            true,
            this.undefines,
            null);

        let args = [
            this.executable,
            '-fsyntax-only',
            '-fno-color-diagnostics',
            '-fno-caret-diagnostics',
            '-fno-diagnostics-show-option',
            '-fdiagnostics-show-category=name',
            '-ferror-limit=200',
            '-fsanitize=address'
        ]
            .concat(iquoteParams)
            .concat(standardParams)
            .concat(pedanticParams)
            .concat(standardLibParams)
            .concat(msExtensions)
            .concat(noExceptions)
            .concat(noRtti)
            .concat(blocks)
            .concat(includeArgParams)
            .concat(warningsParams)
            .concat(defineParams)
            .concat(undefineParams)
            .concat(includePathParams)
            .concat(languageParam)
            .concat(this.settings['verbosefeedback'].clang.extraArgs || []);

        if (this.settings['verbosefeedback'].run === 'onType') {
            args.push(tmpFileName);
        } else {
            args.push(fileName);
        }

        this.actualFileName = fileName;
        this.tmpFileName = tmpFileName;

        return args;
    }


    protected parseLine(line: string): InternalDiagnostic | null {
        let regex = /^(.+?):([0-9]+):([0-9]+):\s(fatal|error|warning|note)(?: error)?:\s(.*)$/;
        let regexArray: RegExpExecArray | null;

        if (line === '') {
            // skip this line
            return null;
        }

        let excludeRegex = /^(WX.*|_WX.*|__WX.*|Q_.*|warning: .* incompatible with .*|warning: .* input unused|warning: include location .* is unsafe for cross-compilation.*)$/;
        if (excludeRegex.exec(line) !== null) {
            // skip this line
            return null;
        }

        let inFileArray: RegExpExecArray | null;
        let inFileRegex = /^In file included from (.+?):([0-9]+):$/;

        if ((inFileArray = inFileRegex.exec(line)) !== null) {
            return {
                fileName: (inFileArray[1] === this.tmpFileName ? this.actualFileName : inFileArray[1]),
                line: parseInt(inFileArray[2]) - 1,
                column: 0,
                severity: DiagnosticSeverity.Warning,
                code: 0,
                message: 'Issues in file included from here',
                source: '[Clang] Verbose Feedback'
            };
        }

        if ((regexArray = regex.exec(line)) !== null) {
            return {
                fileName: (regexArray[1] === this.tmpFileName ? this.actualFileName : regexArray[1]),
                line: parseInt(regexArray[2]) - 1,
                column: parseInt(regexArray[3]) - 1,
                severity: this.getSeverityCode(regexArray[4]),
                code: 0,
                message: regexArray[5],
                source: '[Clang] Verbose Feedback',
            };
        } else {
            return {
                parseError: 'Line could not be parsed: ' + line,
                fileName: '',
                line: 0,
                column: 0,
                severity: DiagnosticSeverity.Error,
                code: 0,
                message: '',
                source: '[Clang] Verbose Feedback'
            };
        }
    }

    private getSeverityCode(severity: string): DiagnosticSeverity {
        let output = this.settings['verbosefeedback'].clang.severityLevels[severity as keyof ClangSeverityMaps];
        return VS_DiagnosticSeverity.from(output);
    }

    private getPedanticParams(): string[] {
        let params: string[] = [];

        if (this.settings['verbosefeedback'].clang.pedantic) {
            params.push(`-pedantic`);
        }

        if (this.settings['verbosefeedback'].clang.pedanticErrors) {
            params.push(`-pedantic-errors`);
        }

        return params;
    }

    private getLanguageParam(): string[] {
        let language = this.language;
        let params: string[] = [];

        if (this.isValidLanguage(language)) {
            params.push(`-x`);
            params.push(`${language}`);
        }


        return params;
    }
}
