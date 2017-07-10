import { BuildConfig, Diagnostic, PrintLine } from '../interfaces';
import { formatFileName, formatHeader, splitLineBreaks } from './logger-util';
import { highlight } from './highlight/highlight';
import * as ts from 'typescript';


/**
 * Ok, so formatting overkill, we know. But whatever, it makes for great
 * error reporting within a terminal. So, yeah, let's code it up, shall we?
 */

export function loadTypeScriptDiagnostics(buildConfig: BuildConfig, resultsDiagnostics: Diagnostic[], tsDiagnostics: ts.Diagnostic[]) {
  tsDiagnostics.forEach(tsDiagnostic => {
    const d = loadDiagnostic(buildConfig, tsDiagnostic);
    if (d) {
      resultsDiagnostics.push(d);
    }
  });
}


function loadDiagnostic(buildConfig: BuildConfig, tsDiagnostic: ts.Diagnostic) {
  const d: Diagnostic = {
    level: 'error',
    type: 'typescript',
    language: 'typescript',
    header: 'typescript error',
    code: tsDiagnostic.code.toString(),
    messageText: ts.flattenDiagnosticMessageText(tsDiagnostic.messageText, '\n'),
    relFilePath: null,
    absFilePath: null,
    lines: []
  };

  // TODO! Why the JSX errors!?
  if (tsDiagnostic.file.fileName.indexOf('jsx.d.ts') > -1) {
    // hack === true
    return null;
  }

  if (tsDiagnostic.file) {
    d.absFilePath = tsDiagnostic.file.fileName;
    d.relFilePath = formatFileName(buildConfig.rootDir, d.absFilePath);

    let sourceText = tsDiagnostic.file.getText();
    let srcLines = splitLineBreaks(sourceText);
    let htmlLines = srcLines;

    try {
      htmlLines = splitLineBreaks(highlight(d.language, sourceText, true).value);
    } catch (e) {}

    const posData = tsDiagnostic.file.getLineAndCharacterOfPosition(tsDiagnostic.start);

    const errorLine: PrintLine = {
      lineIndex: posData.line,
      lineNumber: posData.line + 1,
      text: srcLines[posData.line],
      html: htmlLines[posData.line],
      errorCharStart: posData.character,
      errorLength: Math.max(tsDiagnostic.length, 1)
    };

    if (errorLine.html && errorLine.html.indexOf('class="hljs') === -1) {
      try {
        errorLine.html = highlight(d.language, errorLine.text, true).value;
      } catch (e) {}
    }

    d.lines.push(errorLine);

    if (errorLine.errorLength === 0 && errorLine.errorCharStart > 0) {
      errorLine.errorLength = 1;
      errorLine.errorCharStart--;
    }

    d.header =  formatHeader('typescript', tsDiagnostic.file.fileName, buildConfig.rootDir, errorLine.lineNumber);

    if (errorLine.lineIndex > 0) {
      const previousLine: PrintLine = {
        lineIndex: errorLine.lineIndex - 1,
        lineNumber: errorLine.lineNumber - 1,
        text: srcLines[errorLine.lineIndex - 1],
        html: htmlLines[errorLine.lineIndex - 1],
        errorCharStart: -1,
        errorLength: -1
      };

      if (previousLine.html && previousLine.html.indexOf('class="hljs') === -1) {
        try {
          previousLine.html = highlight(d.language, previousLine.text, true).value;
        } catch (e) {}
      }

      d.lines.unshift(previousLine);
    }

    if (errorLine.lineIndex + 1 < srcLines.length) {
      const nextLine: PrintLine = {
        lineIndex: errorLine.lineIndex + 1,
        lineNumber: errorLine.lineNumber + 1,
        text: srcLines[errorLine.lineIndex + 1],
        html: htmlLines[errorLine.lineIndex + 1],
        errorCharStart: -1,
        errorLength: -1
      };

      if (nextLine.html && nextLine.html.indexOf('class="hljs') === -1) {
        try {
          nextLine.html = highlight(d.language, nextLine.text, true).value;
        } catch (e) {}
      }

      d.lines.push(nextLine);
    }
  }

  return d;
}
