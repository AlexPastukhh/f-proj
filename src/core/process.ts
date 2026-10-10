import { spawn } from 'node:child_process';

export interface WorkerResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
  stdout?: string;
  stderr?: string;
  timedOut?: boolean;
  exitCode?: number | null;
}

export interface WorkerLaunchOptions {
  env?: Record<string, string | undefined>;
  label?: string;
  log?: (message: string) => void;
}

function quoteArg(value: string): string {
  return /\s/.test(value) ? JSON.stringify(value) : value;
}

export async function runProcess(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  options: WorkerLaunchOptions = {},
): Promise<WorkerResult<string>> {
  return await new Promise(resolve => {
    const label = options.label ?? 'process';
    const log = options.log ?? (() => {});
    log(`${label}: spawn ${quoteArg(command)} ${args.map(quoteArg).join(' ')}`);
    log(`${label}: cwd ${cwd}`);

    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: options.env ?? process.env,
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (result: WorkerResult<string>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (stdout.trim()) log(`${label}: stdout\n${stdout.trimEnd()}`);
      if (stderr.trim()) log(`${label}: stderr\n${stderr.trimEnd()}`);
      resolve(result);
    };
    const timer = setTimeout(() => {
      log(`${label}: timeout after ${timeoutMs}ms; killing pid ${child.pid ?? 'unknown'}`);
      child.kill('SIGKILL');
      finish({ ok:false, error:`Process timed out after ${timeoutMs}ms`, stdout, stderr, timedOut:true, exitCode:null });
    }, timeoutMs);
    child.stdout.on('data', (b: any) => stdout += b.toString('utf8'));
    child.stderr.on('data', (b: any) => stderr += b.toString('utf8'));
    child.on('error', (err: Error) => {
      log(`${label}: spawn error: ${err.message}`);
      finish({ ok:false, error:err.message, stdout, stderr, exitCode:null });
    });
    child.on('close', (code: number | null) => {
      if (settled) return;
      log(`${label}: exited with code ${code}`);
      if (code !== 0) return finish({ ok:false, error:`Process exited with code ${code}`, stdout, stderr, exitCode:code });
      finish({ ok:true, value:stdout, stdout, stderr, exitCode:code });
    });
  });
}

export async function runJsonWorker<T>(
  command: string,
  args: string[],
  input: unknown,
  cwd: string,
  timeoutMs: number,
  options: WorkerLaunchOptions = {},
): Promise<WorkerResult<T>> {
  return await new Promise(resolve => {
    const label = options.label ?? 'worker';
    const log = options.log ?? (() => {});
    log(`${label}: spawn ${quoteArg(command)} ${args.map(quoteArg).join(' ')}`);
    log(`${label}: cwd ${cwd}`);

    const child = spawn(command, args, {
      cwd,
      stdio: ['pipe','pipe','pipe'],
      env: options.env ?? process.env,
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (result: WorkerResult<T>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // JSON stdout is normally intentionally quiet. On failure, surface it too:
      // some child runtimes report launch/loader errors on stdout rather than stderr.
      if (!result.ok && stdout.trim()) log(`${label}: stdout\n${stdout.trimEnd()}`);
      if (stderr.trim()) log(`${label}: stderr\n${stderr.trimEnd()}`);
      resolve(result);
    };
    const timer = setTimeout(() => {
      log(`${label}: timeout after ${timeoutMs}ms; killing pid ${child.pid ?? 'unknown'}`);
      child.kill('SIGKILL');
      finish({ ok:false, error:`Worker timed out after ${timeoutMs}ms`, stdout, stderr, timedOut:true, exitCode:null });
    }, timeoutMs);
    child.stdout.on('data', (b: any) => stdout += b.toString('utf8'));
    child.stderr.on('data', (b: any) => stderr += b.toString('utf8'));
    child.on('error', (err: Error) => {
      log(`${label}: spawn error: ${err.message}`);
      finish({ ok:false, error:err.message, stdout, stderr, exitCode:null });
    });
    child.on('close', (code: number | null) => {
      if (settled) return;
      log(`${label}: exited with code ${code}`);
      if (code !== 0) return finish({ ok:false, error:`Worker exited with code ${code}`, stdout, stderr, exitCode:code });
      try { finish({ ok:true, value: JSON.parse(stdout), stdout, stderr, exitCode:code }); }
      catch (err: any) {
        log(`${label}: invalid JSON: ${err.message}`);
        finish({ ok:false, error:`Worker returned invalid JSON: ${err.message}`, stdout, stderr, exitCode:code });
      }
    });
    child.stdin.end(JSON.stringify(input));
  });
}
