/**
 * src/synthesizer/private-net.ts
 * Automatic inter-service private network IP & environment variable injector.
 */
import { StackTopologySpec } from './types.js';
/**
 * Injects inter-service private network environment variables into all runtimes in the topology spec.
 */
export declare function injectPrivateNetEnv(spec: StackTopologySpec): StackTopologySpec;
/**
 * Alias for injectPrivateNetEnv.
 */
export declare function injectPrivateNetworkEnvs(spec: StackTopologySpec): StackTopologySpec;
//# sourceMappingURL=private-net.d.ts.map