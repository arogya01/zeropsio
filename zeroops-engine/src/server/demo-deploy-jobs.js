/**
 * Background job store for the demo's real deploy.
 *
 * Why the deploy is not streamed down one long response any more: a real import
 * plus build takes minutes, and the Zerops L7 balancer closes a response that
 * goes ~60s without a byte. The pipeline has silent gaps far longer than that —
 * core-services activation, `zcli push`, the verify poll — so the connection was
 * being killed mid-build and the browser reported a network error while the
 * deploy carried on running server-side, invisible.
 *
 * So a deploy is detached from any single request: `create()` mints a job, the
 * pipeline appends events to it, and the client collects them with short polls
 * that cannot idle out. A dropped connection or a page refresh no longer loses
 * the run — the job id is enough to pick the log back up.
 */

/**
 * @typedef {{ type: string, [k: string]: unknown }} DeployEvent
 * @typedef {{ events: DeployEvent[], done: boolean, startedAt: number,
 *             finishedAt: number|null }} Job
 */

/** Bounded so a runaway `zcli` log cannot grow the process without limit. */
const MAX_EVENTS = 2000;

/** How long a finished job stays readable, so a slow last poll still sees it. */
const RETAIN_MS = 15 * 60 * 1000;

/** Nothing should hold a slot forever if the pipeline itself wedges. */
const MAX_AGE_MS = 30 * 60 * 1000;

/** @type {Map<string, Job>} */
const jobs = new Map();

let seq = 0;

/**
 * Drop jobs that are finished-and-old, or so old they cannot still be live.
 * Called on every create/read, which is often enough without a timer.
 */
function prune(now) {
  for (const [id, job] of jobs) {
    const expired = job.finishedAt
      ? now - job.finishedAt > RETAIN_MS
      : now - job.startedAt > MAX_AGE_MS;
    if (expired) jobs.delete(id);
  }
}

/**
 * @param {number} now Injected so callers stay testable without faking Date.
 * @returns {string} job id
 */
function create(now = Date.now()) {
  prune(now);
  seq += 1;
  const id = `dep-${now.toString(36)}-${seq.toString(36)}`;
  jobs.set(id, { events: [], done: false, startedAt: now, finishedAt: null });
  return id;
}

/**
 * Record one event. Ignored for unknown or already-finished jobs so a late
 * pipeline callback cannot resurrect a job the client has stopped reading.
 * @param {string} id
 * @param {DeployEvent} event
 */
function append(id, event) {
  const job = jobs.get(id);
  if (!job || job.done) return;
  if (job.events.length >= MAX_EVENTS) return;
  job.events.push(event);
}

/**
 * Append the terminal event and close the job.
 * @param {string} id
 * @param {DeployEvent} event The `done` or `error` event.
 */
function finish(id, event, now = Date.now()) {
  const job = jobs.get(id);
  if (!job || job.done) return;
  // Push before flipping `done`, which `append` refuses to write past.
  job.events.push(event);
  job.done = true;
  job.finishedAt = now;
}

/**
 * Everything recorded after `from`, plus whether the job has finished.
 * @param {string} id
 * @param {number} from Cursor the client last received (0 for a new reader).
 * @returns {{ events: DeployEvent[], next: number, done: boolean }|null}
 */
function read(id, from = 0, now = Date.now()) {
  prune(now);
  const job = jobs.get(id);
  if (!job) return null;
  const start = Number.isFinite(from) && from > 0 ? Math.min(from, job.events.length) : 0;
  return {
    events: job.events.slice(start),
    next: job.events.length,
    done: job.done,
  };
}

/**
 * Jobs still running. A project only counts against the demo quota once it has
 * finished, so without this an impatient double-click would start several real
 * imports before any of them registered.
 */
function activeCount(now = Date.now()) {
  prune(now);
  let n = 0;
  for (const job of jobs.values()) if (!job.done) n += 1;
  return n;
}

/** Test/ops helper — not used by the request path. */
function reset() {
  jobs.clear();
  seq = 0;
}

module.exports = {
  create,
  append,
  finish,
  read,
  activeCount,
  reset,
  jobs,
  MAX_EVENTS,
  RETAIN_MS,
  MAX_AGE_MS,
};
