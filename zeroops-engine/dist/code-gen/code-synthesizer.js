"use strict";
/**
 * src/code-gen/code-synthesizer.ts
 * Multi-service code synthesizer orchestrating template synthesis across UI, REST/gRPC API,
 * Queue Worker, and PostgreSQL SQL DB migrations based on StackTopologySpec.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeSynthesizer = void 0;
exports.synthesizeCode = synthesizeCode;
const template_generator_js_1 = require("./template-generator.js");
const stub_validator_js_1 = require("./stub-validator.js");
class CodeSynthesizer {
    synthesizeCode(spec, options) {
        if (!spec || !spec.runtimes) {
            throw new Error('Invalid StackTopologySpec provided to CodeSynthesizer');
        }
        const files = (0, template_generator_js_1.generateTemplates)(spec, options);
        const validation = this.validateZeroStubs(files);
        return {
            files,
            hasPlaceholders: !validation.isClean,
            astValid: validation.astValid,
            stubsFound: validation.stubsFound
        };
    }
    validateZeroStubs(files) {
        return (0, stub_validator_js_1.validateZeroStubs)(files);
    }
}
exports.CodeSynthesizer = CodeSynthesizer;
function synthesizeCode(spec, options) {
    const synthesizer = new CodeSynthesizer();
    return synthesizer.synthesizeCode(spec, options);
}
//# sourceMappingURL=code-synthesizer.js.map