import { EventEmitter } from 'events';

/**
 * Builds a fake child_process-shaped emitter that stands in for the real
 * `zcli` binary under `vi.spyOn(childProcess, 'spawn')`.
 *
 * Used to give tests a CONTROLLED provisioning outcome (a chosen exit code
 * and stdout) instead of depending on whatever a real `zcli` invocation on
 * the host machine happens to do — which is ambient, unpredictable state,
 * not a test invariant.
 *
 * @param exitCode - the code the fake process should exit with
 * @param stdout - optional stdout payload emitted before 'close' (e.g. a
 *   real-shaped `https://<sub>.zerops.app` URL for a success case)
 */
export function fakeZcliProc(exitCode: number, stdout = ''): any {
  const proc: any = new EventEmitter();
  proc.stdin = { write: () => {}, end: () => {} };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  setTimeout(() => {
    if (stdout) proc.stdout.emit('data', Buffer.from(stdout));
    proc.emit('close', exitCode);
  }, 0);
  return proc;
}
