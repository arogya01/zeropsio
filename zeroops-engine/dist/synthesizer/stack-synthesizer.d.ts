/**
 * src/synthesizer/stack-synthesizer.ts
 * Natural language prompt parser for ZeroOps Stack Synthesizer.
 * Guarantees at least 3 runtimes + 2 managed services (PostgreSQL HA, Valkey HA).
 */
import { StackTopologySpec } from './types.js';
export interface ParseOptions {
    projectName?: string;
    defaultMode?: 'HA' | 'SINGLE';
}
/**
 * Parses natural language prompt into a StackTopologySpec.
 * Guarantees at least 3 runtimes (Node frontend, Go API, Python worker) and 2 managed DBs (Postgres, Valkey).
 */
export declare function parsePromptToTopology(prompt: string, options?: ParseOptions): StackTopologySpec;
/**
 * Primary alias for prompt parsing stack synthesizer.
 */
export declare function synthesizeStack(prompt: string, options?: ParseOptions): StackTopologySpec;
//# sourceMappingURL=stack-synthesizer.d.ts.map