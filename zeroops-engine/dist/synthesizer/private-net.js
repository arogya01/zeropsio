"use strict";
/**
 * src/synthesizer/private-net.ts
 * Automatic inter-service private network IP & environment variable injector.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.injectPrivateNetEnv = injectPrivateNetEnv;
exports.injectPrivateNetworkEnvs = injectPrivateNetworkEnvs;
/**
 * Injects inter-service private network environment variables into all runtimes in the topology spec.
 */
function injectPrivateNetEnv(spec) {
    const postgresService = spec.managedServices.find(s => s.type === 'postgresql');
    const valkeyService = spec.managedServices.find(s => s.type === 'valkey');
    const apiService = spec.runtimes.find(r => r.name === 'api' || r.name.includes('api') || r.name.includes('backend'));
    const dbHost = postgresService ? postgresService.name : 'postgres';
    const dbPort = postgresService?.port || 5432;
    const dbUser = postgresService?.user || 'zerops';
    const dbPass = postgresService?.password || 'zerops_secure_pass_2026';
    const dbName = postgresService?.dbName || 'zeroops_db';
    const valkeyHost = valkeyService ? valkeyService.name : 'valkey';
    const valkeyPort = valkeyService?.port || 6379;
    const apiHost = apiService ? apiService.name : 'api';
    const apiPort = apiService?.ports[0] || 8080;
    const databaseUrl = `postgres://${dbUser}:${dbPass}@${dbHost}:${dbPort}/${dbName}`;
    const redisUrl = `redis://${valkeyHost}:${valkeyPort}`;
    const apiUrl = `http://${apiHost}:${apiPort}`;
    const updatedRuntimes = spec.runtimes.map(runtime => {
        const primaryPort = runtime.ports[0] || 8080;
        const injectedEnvs = {
            PORT: primaryPort.toString(),
            NODE_ENV: 'production',
            DB_HOST: dbHost,
            DB_PORT: dbPort.toString(),
            DB_USER: dbUser,
            DB_PASSWORD: dbPass,
            DB_NAME: dbName,
            DATABASE_URL: databaseUrl,
            VALKEY_HOST: valkeyHost,
            VALKEY_PORT: valkeyPort.toString(),
            REDIS_URL: redisUrl,
            API_HOST: apiHost,
            API_PORT: apiPort.toString(),
            API_URL: apiUrl,
            ...runtime.envVariables // Preserve any existing custom env variables
        };
        return {
            ...runtime,
            envVariables: injectedEnvs
        };
    });
    return {
        ...spec,
        runtimes: updatedRuntimes
    };
}
/**
 * Alias for injectPrivateNetEnv.
 */
function injectPrivateNetworkEnvs(spec) {
    return injectPrivateNetEnv(spec);
}
//# sourceMappingURL=private-net.js.map