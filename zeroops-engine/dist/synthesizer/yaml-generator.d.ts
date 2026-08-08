/**
 * src/synthesizer/yaml-generator.ts
 * Generates spec-compliant zerops-project-import.yml and zerops.yml from StackTopologySpec.
 */
import { StackTopologySpec, GeneratedConfigs, SupportedRuntime, SupportedManagedService } from './types.js';
/**
 * Maps standard runtime identifier to Zerops version tag.
 */
export declare function getRuntimeVersionTag(runtime: SupportedRuntime): string;
/**
 * Maps managed service type to Zerops version tag.
 */
export declare function getManagedServiceVersionTag(serviceType: SupportedManagedService): string;
/**
 * Generates valid zerops-project-import.yml content.
 */
export declare function generateProjectImportYaml(spec: StackTopologySpec): string;
/**
 * Generates valid zerops.yml content for runtime containers.
 */
export declare function generateZeropsYaml(spec: StackTopologySpec): string;
/**
 * Main generator function returning both zerops-project-import.yml and zerops.yml.
 */
export declare function generateZeropsConfigs(spec: StackTopologySpec): GeneratedConfigs;
//# sourceMappingURL=yaml-generator.d.ts.map