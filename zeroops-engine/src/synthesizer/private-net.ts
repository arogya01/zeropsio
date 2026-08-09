/**
 * src/synthesizer/private-net.ts
 * Automatic inter-service private network IP & environment variable injector.
 */

import { StackTopologySpec, RuntimeSpec } from './types.js';

/**
 * Injects inter-service private network environment variables into all runtimes in the topology spec.
 */
export function injectPrivateNetEnv(spec: StackTopologySpec): StackTopologySpec {
  const postgresService = spec.managedServices.find(
    s => s.type === 'postgresql' || (s.type as string) === 'postgres' || (s.name && s.name.toLowerCase().includes('postgres'))
  );
  const valkeyService = spec.managedServices.find(
    s => s.type === 'valkey' || (s.type as string) === 'redis' || (s.name && (s.name.toLowerCase().includes('valkey') || s.name.toLowerCase().includes('redis')))
  );
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

  const updatedRuntimes: RuntimeSpec[] = spec.runtimes.map(runtime => {
    const primaryPort = runtime.ports[0] || 8080;

    const injectedEnvs: Record<string, string> = {
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
export function injectPrivateNetworkEnvs(spec: StackTopologySpec): StackTopologySpec {
  return injectPrivateNetEnv(spec);
}
