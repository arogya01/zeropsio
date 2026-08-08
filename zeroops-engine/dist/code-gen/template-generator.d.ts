/**
 * src/code-gen/template-generator.ts
 * Production-ready multi-service application code templates generator.
 * Produces Frontend UI components, REST/gRPC API handlers, Background Queue Consumers,
 * and PostgreSQL schema migrations with ZERO placeholder stubs.
 */
import { StackTopologySpec } from '../synthesizer/types.js';
export interface CodeTemplateOptions {
    projectName?: string;
    enableGrpc?: boolean;
}
/**
 * Generates Frontend UI code components (React TSX / HTML / CSS / Tailwind).
 */
export declare function generateFrontend(spec: StackTopologySpec, _options?: CodeTemplateOptions): Record<string, string>;
/**
 * Generates REST / gRPC API Handler code.
 */
export declare function generateApi(spec: StackTopologySpec, options?: CodeTemplateOptions): Record<string, string>;
/**
 * Generates Background Worker Queue Consumer code.
 */
export declare function generateWorker(spec: StackTopologySpec, _options?: CodeTemplateOptions): Record<string, string>;
/**
 * Generates PostgreSQL schema migrations.
 */
export declare function generateSqlMigrations(spec: StackTopologySpec, _options?: CodeTemplateOptions): Record<string, string>;
/**
 * Aggregates all template files into a single files dictionary.
 */
export declare function generateTemplates(spec: StackTopologySpec, options?: CodeTemplateOptions): Record<string, string>;
//# sourceMappingURL=template-generator.d.ts.map