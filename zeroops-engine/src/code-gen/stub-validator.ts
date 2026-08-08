/**
 * src/code-gen/stub-validator.ts
 * AST & Polyglot zero-stub completeness validator that rejects placeholders/stubs.
 * Uses TypeScript Compiler API for AST inspection of JS/TS/TSX/JSX files.
 */

import ts from 'typescript';

export interface StubViolation {
  file: string;
  line?: number;
  column?: number;
  rule: string;
  message: string;
  snippet: string;
}

export interface StubValidationResult {
  isClean: boolean;
  stubsFound: string[];
  astValid: boolean;
  violations: StubViolation[];
}

/**
 * Validates JS/TS/TSX/JSX files using TypeScript Compiler API AST inspection.
 */
export function validateTsAst(filePath: string, content: string): { astValid: boolean; violations: StubViolation[] } {
  const violations: StubViolation[] = [];
  let astValid = true;

  const isJsx = filePath.endsWith('.tsx') || filePath.endsWith('.jsx');
  const scriptKind = isJsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS;

  let sourceFile: ts.SourceFile;
  try {
    sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, scriptKind);
  } catch {
    return {
      astValid: false,
      violations: [
        {
          file: filePath,
          rule: 'PARSE_ERROR',
          message: 'Failed to parse file AST with TypeScript Compiler API',
          snippet: content.substring(0, 100)
        }
      ]
    };
  }

  // Check for TypeScript syntax parsing errors (parseDiagnostics)
  const parseDiagnostics = (sourceFile as any).parseDiagnostics as ts.Diagnostic[] | undefined;
  if (parseDiagnostics && parseDiagnostics.length > 0) {
    astValid = false;
    for (const diag of parseDiagnostics) {
      const messageText = typeof diag.messageText === 'string' ? diag.messageText : diag.messageText.messageText;
      const startPos = diag.start ?? 0;
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(startPos);
      violations.push({
        file: filePath,
        line: line + 1,
        column: character + 1,
        rule: 'TS_SYNTAX_ERROR',
        message: `TypeScript syntax error: ${messageText}`,
        snippet: content.substring(startPos, Math.min(content.length, startPos + 50))
      });
    }
  }

  // 1. Scan for comment stubs using ts.createScanner (skipTrivia = false)
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, content);
  let token = scanner.scan();
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    if (token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia) {
      const commentText = scanner.getTokenText();
      if (/\b(TODO|STUB|FIXME|XXX|HACK|PLACEHOLDER|NOT[_\s]IMPLEMENTED|UNIMPLEMENTED|DUMMY)\b/i.test(commentText)) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(scanner.getTokenPos());
        violations.push({
          file: filePath,
          line: line + 1,
          column: character + 1,
          rule: 'COMMENT_STUB',
          message: `Forbidden comment stub: ${commentText.trim()}`,
          snippet: commentText.trim()
        });
      }
    }
    token = scanner.scan();
  }

  // 2. Walk AST nodes for code structural stubs
  function visit(node: ts.Node) {
    // Empty function body (functions, methods, arrow functions)
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node)
    ) {
      if (node.body && ts.isBlock(node.body)) {
        if (node.body.statements.length === 0) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          violations.push({
            file: filePath,
            line: line + 1,
            column: character + 1,
            rule: 'EMPTY_FUNCTION_BODY',
            message: 'Empty function body with zero statements',
            snippet: node.getText(sourceFile)
          });
        }
      }
    }

    // Thrown Not Implemented error
    if (ts.isThrowStatement(node)) {
      const exprText = node.expression.getText(sourceFile);
      if (/not implemented|todo|stub|unimplemented|placeholder/i.test(exprText)) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        violations.push({
          file: filePath,
          line: line + 1,
          column: character + 1,
          rule: 'THROW_NOT_IMPLEMENTED',
          message: 'Throw statement with placeholder error message',
          snippet: node.getText(sourceFile)
        });
      }
    }

    // Explicit 'any' type keyword
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      violations.push({
        file: filePath,
        line: line + 1,
        column: character + 1,
        rule: 'EXPLICIT_ANY_TYPE',
        message: 'Forbidden explicit "any" type keyword',
        snippet: node.parent ? node.parent.getText(sourceFile) : node.getText(sourceFile)
      });
    }

    // Hardcoded mock return strings
    if (ts.isReturnStatement(node) && node.expression) {
      const returnText = node.expression.getText(sourceFile);
      if (/['"`](dummy_value|placeholder_string|todo_impl|mocked_return|stub_data)['"`]/i.test(returnText)) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        violations.push({
          file: filePath,
          line: line + 1,
          column: character + 1,
          rule: 'MOCK_RETURN_VALUE',
          message: 'Return statement returning hardcoded dummy/mock placeholder string',
          snippet: node.getText(sourceFile)
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return { astValid, violations };
}

/**
 * Go syntax & string literal completeness validator.
 * Detects unterminated string literals (unescaped physical newlines inside double-quoted strings).
 */
export function validateGoSyntax(filePath: string, content: string): StubViolation[] {
  const violations: StubViolation[] = [];
  let inDoubleQuote = false;
  let inRawString = false;
  let inSingleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  let line = 1;
  let col = 1;
  let doubleQuoteStartLine = 0;
  let doubleQuoteStartCol = 0;
  let doubleQuoteSnippet = '';

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (char === '\n') {
      if (inDoubleQuote) {
        violations.push({
          file: filePath,
          line: doubleQuoteStartLine,
          column: doubleQuoteStartCol,
          rule: 'GO_UNTERMINATED_STRING_LITERAL',
          message: 'Go double-quoted string literal contains unescaped physical newline (unterminated string literal)',
          snippet: doubleQuoteSnippet.trim()
        });
        inDoubleQuote = false;
      }
      if (inLineComment) {
        inLineComment = false;
      }
      line++;
      col = 1;
      continue;
    }

    col++;

    if (inLineComment) continue;

    if (inBlockComment) {
      if (char === '/' && i > 0 && content[i - 1] === '*') {
        inBlockComment = false;
      }
      continue;
    }

    if (inRawString) {
      if (char === '`') {
        inRawString = false;
      }
      continue;
    }

    if (inSingleQuote) {
      if (char === "'" && (i === 0 || content[i - 1] !== '\\')) {
        inSingleQuote = false;
      }
      continue;
    }

    if (inDoubleQuote) {
      if (char === '"') {
        let backslashCount = 0;
        let k = i - 1;
        while (k >= 0 && content[k] === '\\') {
          backslashCount++;
          k--;
        }
        if (backslashCount % 2 === 0) {
          inDoubleQuote = false;
        }
      }
      continue;
    }

    // Outside quotes and comments
    if (char === '/' && i + 1 < content.length && content[i + 1] === '/') {
      inLineComment = true;
      i++;
      col++;
      continue;
    }
    if (char === '/' && i + 1 < content.length && content[i + 1] === '*') {
      inBlockComment = true;
      i++;
      col++;
      continue;
    }
    if (char === '`') {
      inRawString = true;
      continue;
    }
    if (char === "'") {
      inSingleQuote = true;
      continue;
    }
    if (char === '"') {
      inDoubleQuote = true;
      doubleQuoteStartLine = line;
      doubleQuoteStartCol = col;
      doubleQuoteSnippet = content.substring(i, Math.min(content.length, i + 80)).split('\n')[0];
      continue;
    }
  }

  if (inDoubleQuote) {
    violations.push({
      file: filePath,
      line: doubleQuoteStartLine,
      column: doubleQuoteStartCol,
      rule: 'GO_UNTERMINATED_STRING_LITERAL',
      message: 'Go double-quoted string literal is unclosed at end of file',
      snippet: doubleQuoteSnippet.trim()
    });
  }

  return violations;
}

/**
 * Polyglot scanner for non-TS/JS files (Python, Go, SQL, HTML, etc.)
 */
export function validateNonTsFile(filePath: string, content: string): StubViolation[] {
  const violations: StubViolation[] = [];
  const lines = content.split('\n');

  const ext = filePath.split('.').pop()?.toLowerCase() || '';

  // Run Go syntax validation for .go files
  if (ext === 'go') {
    const goSyntaxViolations = validateGoSyntax(filePath, content);
    violations.push(...goSyntaxViolations);
  }

  // 1. Line-by-line regex checks
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];

    // Check comments & strings for TODO/STUB/FIXME
    const isPolyglotStub =
      /\b(TODO|STUB|FIXME|XXX|HACK|NOT[_\s]IMPLEMENTED|UNIMPLEMENTED)\b/i.test(line) ||
      (/\bPLACEHOLDER\b/i.test(line) && !/placeholder\s*[:=]/i.test(line));

    if (isPolyglotStub) {
      violations.push({
        file: filePath,
        line: lineNum,
        rule: 'POLYGLOT_STUB_TEXT',
        message: `Forbidden stub text found: "${line.trim()}"`,
        snippet: line.trim()
      });
    }

    // Python specific checks
    if (ext === 'py') {
      if (/^\s*pass\s*$/.test(line) && i > 0 && /def\s+\w+|class\s+\w+/.test(lines[i - 1])) {
        violations.push({
          file: filePath,
          line: lineNum,
          rule: 'PYTHON_PASS_STUB',
          message: 'Python pass statement used as placeholder body',
          snippet: line.trim()
        });
      }
      if (/raise\s+(NotImplementedError|Exception\s*\(\s*['"]Not implemented)/i.test(line)) {
        violations.push({
          file: filePath,
          line: lineNum,
          rule: 'PYTHON_RAISE_NOT_IMPLEMENTED',
          message: 'Python raise NotImplementedError placeholder',
          snippet: line.trim()
        });
      }
    }

    // Go specific checks
    if (ext === 'go') {
      if (/panic\s*\(\s*["'].*?(not implemented|todo|stub|unimplemented).*?["']\s*\)/i.test(line)) {
        violations.push({
          file: filePath,
          line: lineNum,
          rule: 'GO_PANIC_STUB',
          message: 'Go panic placeholder call',
          snippet: line.trim()
        });
      }
    }

    // HTML/UI placeholder checks
    if (ext === 'html' || ext === 'jsx' || ext === 'tsx') {
      if (/>\s*(TODO|Placeholder|Lorem ipsum|Stub)\s*</i.test(line)) {
        violations.push({
          file: filePath,
          line: lineNum,
          rule: 'UI_PLACEHOLDER_TEXT',
          message: 'UI HTML/JSX tag containing placeholder text',
          snippet: line.trim()
        });
      }
    }
  }

  // Go empty function body check
  if (ext === 'go') {
    if (/func\s+(?:\([^)]+\)\s+)?\w+\s*\([^)]*\)[^{]*\{\s*\}/.test(content)) {
      violations.push({
        file: filePath,
        rule: 'GO_EMPTY_FUNCTION',
        message: 'Go function body is empty',
        snippet: content.substring(0, 100)
      });
    }
  }

  // SQL migration completeness check
  if (ext === 'sql') {
    const ddlKeywords = ['CREATE TABLE', 'ALTER TABLE', 'CREATE INDEX', 'CREATE TYPE', 'CREATE EXTENSION', 'INSERT INTO', 'DROP TABLE'];
    const hasDdl = ddlKeywords.some(keyword => content.toUpperCase().includes(keyword));
    if (!hasDdl || content.trim().length === 0) {
      violations.push({
        file: filePath,
        rule: 'EMPTY_SQL_MIGRATION',
        message: 'SQL migration file contains no DDL statements or seed data',
        snippet: content.substring(0, 100)
      });
    }
  }

  return violations;
}

/**
 * Main exported function to validate zero stubs across all files.
 */
export function validateZeroStubs(files: Record<string, string>): StubValidationResult {
  const allViolations: StubViolation[] = [];
  const stubsFound: string[] = [];
  let astValidOverall = true;

  for (const [filePath, content] of Object.entries(files)) {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';

    if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) {
      const astResult = validateTsAst(filePath, content);
      if (!astResult.astValid) {
        astValidOverall = false;
      }
      allViolations.push(...astResult.violations);
      const textViolations = validateNonTsFile(filePath, content);
      for (const tv of textViolations) {
        if (!allViolations.some((v) => v.file === tv.file && v.line === tv.line && v.rule === tv.rule)) {
          allViolations.push(tv);
        }
      }
    } else {
      const nonTsViolations = validateNonTsFile(filePath, content);
      if (
        nonTsViolations.some(
          (v) =>
            v.rule.includes('UNTERMINATED') ||
            v.rule.includes('SYNTAX') ||
            v.rule.includes('PARSE_ERROR')
        )
      ) {
        astValidOverall = false;
      }
      allViolations.push(...nonTsViolations);
    }
  }

  for (const v of allViolations) {
    const location = v.line ? `${v.file}:${v.line}` : v.file;
    stubsFound.push(`[${location}] [${v.rule}] ${v.message}`);
  }

  return {
    isClean: allViolations.length === 0,
    stubsFound,
    astValid: astValidOverall,
    violations: allViolations
  };
}
