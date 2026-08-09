import { describe, it, expect, beforeEach } from 'vitest';

const jobs = require('../src/server/demo-deploy-jobs');

/**
 * The demo's real deploy runs detached from any request because the platform
 * proxy kills a response that goes ~60s without a byte, and the build has silent
 * stretches far longer than that. These tests pin the cursor contract the browser
 * polls against, plus the two properties that keep a demo honest: a finished job
 * cannot be reopened, and an in-flight job counts against the deploy quota.
 */
describe('demo deploy job store', () => {
  beforeEach(() => jobs.reset());

  it('replays only what the caller has not seen yet', () => {
    const id = jobs.create();
    jobs.append(id, { type: 'stage', stage: 'scaffold' });
    jobs.append(id, { type: 'log', text: 'first' });

    const first = jobs.read(id, 0);
    expect(first.events).toHaveLength(2);
    expect(first.next).toBe(2);
    expect(first.done).toBe(false);

    // Nothing new since the last cursor.
    expect(jobs.read(id, first.next).events).toEqual([]);

    jobs.append(id, { type: 'log', text: 'second' });
    const second = jobs.read(id, first.next);
    expect(second.events).toEqual([{ type: 'log', text: 'second' }]);
    expect(second.next).toBe(3);
  });

  it('reports an unknown or expired job as missing rather than empty', () => {
    // The route turns null into a 404; an empty snapshot would look to the
    // client like a healthy build that never produces anything.
    expect(jobs.read('dep-nope', 0)).toBeNull();
  });

  it('closes on the terminal event and ignores anything appended after', () => {
    const id = jobs.create();
    jobs.append(id, { type: 'log', text: 'building' });
    jobs.finish(id, { type: 'done', liveUrl: 'https://webapp-abcd-3000.prg1.zerops.app' });
    jobs.append(id, { type: 'log', text: 'too late' });

    const snap = jobs.read(id, 0);
    expect(snap.done).toBe(true);
    expect(snap.events.map((e: any) => e.type)).toEqual(['log', 'done']);
  });

  it('keeps the terminal event readable from a cursor set before it', () => {
    const id = jobs.create();
    jobs.append(id, { type: 'log', text: 'building' });
    const mid = jobs.read(id, 0).next;
    jobs.finish(id, { type: 'error', error: 'push failed' });

    // A client whose last poll landed mid-build must still receive the outcome.
    const snap = jobs.read(id, mid);
    expect(snap.done).toBe(true);
    expect(snap.events).toEqual([{ type: 'error', error: 'push failed' }]);
  });

  it('counts in-flight deploys, which have no project registered yet', () => {
    const a = jobs.create();
    const b = jobs.create();
    expect(jobs.activeCount()).toBe(2);

    jobs.finish(a, { type: 'done' });
    expect(jobs.activeCount()).toBe(1);

    jobs.finish(b, { type: 'error', error: 'nope' });
    expect(jobs.activeCount()).toBe(0);
  });

  it('caps recorded events so a chatty build cannot grow without limit', () => {
    const id = jobs.create();
    for (let i = 0; i < jobs.MAX_EVENTS + 50; i += 1) {
      jobs.append(id, { type: 'log', text: `line ${i}` });
    }
    expect(jobs.read(id, 0).events).toHaveLength(jobs.MAX_EVENTS);
  });

  it('forgets a finished job once its retention window passes', () => {
    const start = 1_000_000;
    const id = jobs.create(start);
    jobs.finish(id, { type: 'done' }, start);

    expect(jobs.read(id, 0, start + jobs.RETAIN_MS - 1)).not.toBeNull();
    expect(jobs.read(id, 0, start + jobs.RETAIN_MS + 1)).toBeNull();
  });

  it('forgets a job that never finished, so it cannot hold a slot forever', () => {
    const start = 2_000_000;
    jobs.create(start);
    expect(jobs.activeCount(start + jobs.MAX_AGE_MS - 1)).toBe(1);
    expect(jobs.activeCount(start + jobs.MAX_AGE_MS + 1)).toBe(0);
  });
});
