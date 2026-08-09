/**
 * Live Auditor Module — Automated Verification Suite for Zerops Live Provisioned Containers
 * Implements IVerificationSuite interface.
 */
export interface HealthAuditResult {
    passed: boolean;
    httpStatus: number;
    liveUrl: string;
    privateDbConnected: boolean;
    privateCacheConnected: boolean;
    queueE2EPassed: boolean;
    latencyMs: number;
    errors: string[];
}
export interface IVerificationSuite {
    auditHttp(url: string): Promise<{
        status: number;
        ok: boolean;
    }>;
    auditDb(connectionString: string): Promise<{
        connected: boolean;
        writeOk: boolean;
    }>;
    auditCache(host: string, port: number): Promise<{
        pingOk: boolean;
    }>;
    auditQueueE2E(apiEndpoint: string): Promise<{
        passed: boolean;
        messageId?: string;
    }>;
    runFullAudit(url: string, projectName?: string, onLogStream?: (msg: string) => void): Promise<HealthAuditResult>;
}
export interface AuditDetails {
    publicHttp: {
        passed: boolean;
        statusCode: number;
    };
    apiGateway: {
        passed: boolean;
        statusCode: number;
    };
    postgresPrivateDb: {
        passed: boolean;
        connected: boolean;
    };
    valkeyPrivateCache: {
        passed: boolean;
        connected: boolean;
    };
}
export interface LiveAuditResult extends HealthAuditResult {
    success: boolean;
    auditsPassed: number;
    auditsTotal: number;
    score: string;
    details: AuditDetails;
}
export interface LiveAuditorOptions {
    retries?: number;
    timeoutMs?: number;
    backoffMs?: number;
    mockMode?: boolean;
    fallbackOnOffline?: boolean;
    postgresHost?: string;
    postgresPort?: number;
    valkeyHost?: string;
    valkeyPort?: number;
}
export declare class LiveAuditor implements IVerificationSuite {
    private retries;
    private timeoutMs;
    private backoffMs;
    mockMode: boolean;
    fallbackOnOffline: boolean;
    private postgresHost;
    private postgresPort;
    private valkeyHost;
    private valkeyPort;
    simulateHttpFailure: boolean;
    simulateDbFailure: boolean;
    simulateCacheFailure: boolean;
    simulateQueueFailure: boolean;
    constructor(options?: LiveAuditorOptions);
    private delay;
    /**
     * Perform HTTP GET request with retries and timeout
     */
    auditHttp(url: string): Promise<{
        status: number;
        ok: boolean;
    }>;
    private httpProbe;
    /**
     * Audit Database connectivity (PostgreSQL over VXLAN 10.160.0.21:5432)
     */
    auditDb(connectionString: string): Promise<{
        connected: boolean;
        writeOk: boolean;
    }>;
    /**
     * Audit Valkey Cache connectivity (Valkey ping over VXLAN 10.160.0.25:6379)
     */
    auditCache(host: string, port: number): Promise<{
        pingOk: boolean;
    }>;
    private tcpProbe;
    /**
     * Audit Queue End-to-End processing
     */
    auditQueueE2E(apiEndpoint: string): Promise<{
        passed: boolean;
        messageId?: string;
    }>;
    /**
     * Run full audit and return LiveAuditResult matching complete schema
     */
    runFullAudit(url: string, projectName?: string, onLogStream?: (msg: string) => void): Promise<LiveAuditResult>;
}
//# sourceMappingURL=live-auditor.d.ts.map