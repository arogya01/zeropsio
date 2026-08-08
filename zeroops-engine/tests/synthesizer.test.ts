import { describe, it, expect } from 'vitest';
import { parsePromptToTopology, synthesizeStack } from '../src/synthesizer/stack-synthesizer.js';

describe('Stack Synthesizer', () => {
  it('should parse a complete prompt into a 5-service topology spec', () => {
    const prompt = 'Build a Node frontend with Go API, Python worker, Postgres DB, and Valkey cache';
    const spec = parsePromptToTopology(prompt, { projectName: 'demo-app' });

    expect(spec.projectName).toBe('demo-app');
    expect(spec.runtimes.length).toBeGreaterThanOrEqual(3);
    expect(spec.managedServices.length).toBeGreaterThanOrEqual(2);

    const runtimeNames = spec.runtimes.map(r => r.name);
    expect(runtimeNames).toContain('frontend');
    expect(runtimeNames).toContain('api');
    expect(runtimeNames).toContain('worker');

    const serviceTypes = spec.managedServices.map(s => s.type);
    expect(serviceTypes).toContain('postgresql');
    expect(serviceTypes).toContain('valkey');
  });

  it('should apply default fallback guaranteeing 3 runtimes and 2 managed DBs on vague prompt', () => {
    const prompt = 'Create a simple web app';
    const spec = synthesizeStack(prompt);

    expect(spec.projectName).toBeDefined();
    expect(spec.runtimes.length).toBe(3);
    expect(spec.managedServices.length).toBe(2);

    const frontend = spec.runtimes.find(r => r.name === 'frontend');
    expect(frontend?.runtime).toBe('nodejs');

    const api = spec.runtimes.find(r => r.name === 'api');
    expect(api?.runtime).toBe('go');

    const worker = spec.runtimes.find(r => r.name === 'worker');
    expect(worker?.runtime).toBe('python');

    const postgres = spec.managedServices.find(s => s.type === 'postgresql');
    expect(postgres?.mode).toBe('HA');

    const valkey = spec.managedServices.find(s => s.type === 'valkey');
    expect(valkey?.mode).toBe('HA');
  });

  it('should support SINGLE mode when prompt specifies single or dev mode', () => {
    const prompt = 'Deploy dev single container web app with postgres and valkey';
    const spec = parsePromptToTopology(prompt);

    const postgres = spec.managedServices.find(s => s.type === 'postgresql');
    expect(postgres?.mode).toBe('SINGLE');
  });

  it('should parse optional rust microservice if mentioned in prompt', () => {
    const prompt = 'Build a Rust microservice with postgres database';
    const spec = parsePromptToTopology(prompt);

    const rustService = spec.runtimes.find(r => r.runtime === 'rust');
    expect(rustService).toBeDefined();
    expect(rustService?.ports).toContain(8090);
  });
});
