/**
 * src/code-gen/code-synthesizer.ts
 * Multi-service code synthesizer orchestrating template synthesis across UI, REST/gRPC API,
 * Queue Worker, and PostgreSQL SQL DB migrations based on StackTopologySpec.
 */

import { StackTopologySpec } from '../synthesizer/types.js';
import { generateTemplates, CodeTemplateOptions } from './template-generator.js';
import { validateZeroStubs } from './stub-validator.js';

export interface GeneratedCodeArtifacts {
  files: Record<string, string>; // path -> content
  hasPlaceholders: boolean;
  astValid: boolean;
  stubsFound?: string[];
}

export interface ICodeSynthesizer {
  synthesizeCode(spec: StackTopologySpec, options?: CodeTemplateOptions): GeneratedCodeArtifacts;
  validateZeroStubs(files: Record<string, string>): { isClean: boolean; stubsFound: string[]; astValid: boolean };
}

export class CodeSynthesizer implements ICodeSynthesizer {
  synthesizeCode(spec: StackTopologySpec, options?: CodeTemplateOptions): GeneratedCodeArtifacts {
    if (!spec || !spec.runtimes) {
      throw new Error('Invalid StackTopologySpec provided to CodeSynthesizer');
    }

    const files = generateTemplates(spec, options);
    const validation = this.validateZeroStubs(files);

    return {
      files,
      hasPlaceholders: !validation.isClean,
      astValid: validation.astValid,
      stubsFound: validation.stubsFound
    };
  }

  validateZeroStubs(files: Record<string, string>): { isClean: boolean; stubsFound: string[]; astValid: boolean } {
    return validateZeroStubs(files);
  }
}

export function synthesizeCode(spec: StackTopologySpec, options?: CodeTemplateOptions): GeneratedCodeArtifacts {
  const synthesizer = new CodeSynthesizer();
  return synthesizer.synthesizeCode(spec, options);
}
