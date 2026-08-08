/**
 * src/code-gen/stub-validator.ts
 * AST & Polyglot zero-stub completeness validator that rejects placeholders/stubs.
 * Uses TypeScript Compiler API for AST inspection of JS/TS/TSX/JSX files.
 */
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
export declare function validateTsAst(filePath: string, content: string): {
    astValid: boolean;
    violations: StubViolation[];
};
/**
 * Go syntax & string literal completeness validator.
 * Detects unterminated string literals (unescaped physical newlines inside double-quoted strings).
 */
export declare function validateGoSyntax(filePath: string, content: string): StubViolation[];
/**
 * Polyglot scanner for non-TS/JS files (Python, Go, SQL, HTML, etc.)
 */
export declare function validateNonTsFile(filePath: string, content: string): StubViolation[];
/**
 * Main exported function to validate zero stubs across all files.
 */
export declare function validateZeroStubs(files: Record<string, string>): StubValidationResult;
//# sourceMappingURL=stub-validator.d.ts.map