/**
 * src/code-gen/code-synthesizer.ts
 * Multi-service code synthesizer orchestrating template synthesis across UI, REST/gRPC API,
 * Queue Worker, and PostgreSQL SQL DB migrations based on StackTopologySpec.
 */
import { StackTopologySpec } from '../synthesizer/types.js';
import { CodeTemplateOptions } from './template-generator.js';
export interface GeneratedCodeArtifacts {
    files: Record<string, string>;
    hasPlaceholders: boolean;
    astValid: boolean;
    stubsFound?: string[];
}
export interface ICodeSynthesizer {
    synthesizeCode(spec: StackTopologySpec, options?: CodeTemplateOptions): GeneratedCodeArtifacts;
    validateZeroStubs(files: Record<string, string>): {
        isClean: boolean;
        stubsFound: string[];
        astValid: boolean;
    };
}
export declare class CodeSynthesizer implements ICodeSynthesizer {
    synthesizeCode(spec: StackTopologySpec, options?: CodeTemplateOptions): GeneratedCodeArtifacts;
    validateZeroStubs(files: Record<string, string>): {
        isClean: boolean;
        stubsFound: string[];
        astValid: boolean;
    };
}
export declare function synthesizeCode(spec: StackTopologySpec, options?: CodeTemplateOptions): GeneratedCodeArtifacts;
//# sourceMappingURL=code-synthesizer.d.ts.map