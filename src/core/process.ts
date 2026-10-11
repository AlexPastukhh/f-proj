import { spawn, ChildProcess } from 'node:child_process';

export interface WorkerResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
  stdout?: string;
  stderr?: string;
  timedOut?: boolean;
  cancelled?: boolean;
  exitCode?: number | null;
}

export interface WorkerLaunchOptions {
  env?: Record<string, string | undefined>;
  label?: string;
  log?: (message: string) => void;
  signal?: AbortSignal;
}

// Always stop the process tree, not merely the node/dotnet launcher.
 // On Windows, killing only the parent can leave test child processes alive.
function terminateTree(child:ChildProcess,log:(line:string)=>void):void {
  const pid=child.pid;
  if(!pid) return;
  if(process.platform==='win32'){
    try {
      const killer=spawn('taskkill',['/PID',String(pid),'/T','/F'],
        {stdio:'ignore',windowsHide:true});
      const fallback=()=>{try{child.kill('SIGKILL');}catch{}};
      killer.on('error',fallback);
      killer.on('close',(code:number|null)=>{if(code!==0) fallback();});
    }catch(err:any){
      log('taskkill could not launch: '+(err?.message??String(err)));
      try{child.kill('SIGKILL');}catch{}
    }
  }else{
    try {process.kill(-pid,'SIGKILL');}
    catch {try{child.kill('SIGKILL');}catch{}}
  }
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
    if(options.signal?.aborted){
      resolve({ok:false,cancelled:true,error:'Process cancelled before spawn',exitCode:null});
      return;
    }
    const label = options.label ?? 'process';
    const log = options.log ?? (() => {});
    log(`${label}: spawn ${quoteArg(command)} ${args.map(quoteArg).join(' ')}`);
    log(`${label}: cwd ${cwd}`);

    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: options.env ?? process.env,
      detached:process.platform!=='win32',
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    let cancelled = false;
    let cancelTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = (result: WorkerResult<string>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if(cancelTimer) clearTimeout(cancelTimer);
      options.signal?.removeEventListener('abort',onAbort);
      if (stdout.trim()) log(`${label}: stdout\n${stdout.trimEnd()}`);
      if (stderr.trim()) log(`${label}: stderr\n${stderr.trimEnd()}`);
      resolve(result);
    };
    const timer = setTimeout(() => {
      log(`${label}: timeout after ${timeoutMs}ms; stopping process tree ${child.pid ?? 'unknown'}`);
      terminateTree(child,log);
      finish({ok:false,error:`Process timed out after ${timeoutMs}ms`,
        stdout,stderr,timedOut:true,exitCode:null});
    }, timeoutMs);
    const onAbort=()=>{
      if(settled||cancelled) return;
      cancelled=true;
      log(`${label}: cancelled; stopping process tree ${child.pid ?? 'unknown'}`);
      terminateTree(child,log);
      cancelTimer=setTimeout(()=>finish({ok:false,cancelled:true,
        error:'Process cancelled (termination not confirmed)',stdout,stderr,exitCode:null}),5000);
    };
    options.signal?.addEventListener('abort',onAbort,{once:true});
    if(options.signal?.aborted) onAbort();
    child.stdout.on('data', (b: any) => stdout += b.toString('utf8'));
    child.stderr.on('data', (b: any) => stderr += b.toString('utf8'));
    child.on('error', (err: Error) => {
      log(`${label}: spawn error: ${err.message}`);
      finish({ ok:false, error:err.message, stdout, stderr, exitCode:null });
    });
    child.on('close', (code: number | null) => {
      if (settled) return;
      log(`${label}: exited with code ${code}`);
      if(cancelled) return finish({ok:false,cancelled:true,
        error:'Process cancelled',stdout,stderr,exitCode:code});
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
    if(options.signal?.aborted){
      resolve({ok:false,cancelled:true,error:'Worker cancelled before spawn',exitCode:null});
      return;
    }
    const label = options.label ?? 'worker';
    const log = options.log ?? (() => {});
    log(`${label}: spawn ${quoteArg(command)} ${args.map(quoteArg).join(' ')}`);
    log(`${label}: cwd ${cwd}`);

    const child = spawn(command, args, {
      cwd,
      stdio: ['pipe','pipe','pipe'],
      env: options.env ?? process.env,
      detached:process.platform!=='win32',
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    let cancelled=false;
    let cancelTimer:ReturnType<typeof setTimeout>|undefined;
    const finish = (result: WorkerResult<T>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if(cancelTimer)clearTimeout(cancelTimer);
      options.signal?.removeEventListener('abort',onAbort);
      // JSON stdout is normally intentionally quiet. On failure, surface it too:
      // some child runtimes report launch/loader errors on stdout rather than stderr.
      if (!result.ok && stdout.trim()) log(`${label}: stdout\n${stdout.trimEnd()}`);
      if (stderr.trim()) log(`${label}: stderr\n${stderr.trimEnd()}`);
      resolve(result);
    };
    const timer = setTimeout(() => {
      log(`${label}: timeout after ${timeoutMs}ms; stopping process tree ${child.pid ?? 'unknown'}`);
      terminateTree(child,log);
      finish({ok:false,error:`Worker timed out after ${timeoutMs}ms`,
        stdout,stderr,timedOut:true,exitCode:null});
    }, timeoutMs);
    const onAbort=()=>{
      if(settled||cancelled)return;
      cancelled=true;
      log(`${label}: cancelled; stopping process tree ${child.pid ?? 'unknown'}`);
      terminateTree(child,log);
      cancelTimer=setTimeout(()=>finish({ok:false,cancelled:true,
        error:'Worker cancelled (termination not confirmed)',stdout,stderr,exitCode:null}),5000);
    };
    options.signal?.addEventListener('abort',onAbort,{once:true});
    if(options.signal?.aborted)onAbort();
    child.stdout.on('data', (b: any) => stdout += b.toString('utf8'));
    child.stderr.on('data', (b: any) => stderr += b.toString('utf8'));
    child.on('error', (err: Error) => {
      log(`${label}: spawn error: ${err.message}`);
      finish({ ok:false, error:err.message, stdout, stderr, exitCode:null });
    });
    child.on('close', (code: number | null) => {
      if (settled) return;
      log(`${label}: exited with code ${code}`);
      if(cancelled)return finish({ok:false,cancelled:true,error:'Worker cancelled',stdout,stderr,exitCode:code});
      if (code !== 0) return finish({ ok:false, error:`Worker exited with code ${code}`, stdout, stderr, exitCode:code });
      try { finish({ ok:true, value: JSON.parse(stdout), stdout, stderr, exitCode:code }); }
      catch (err: any) {
        log(`${label}: invalid JSON: ${err.message}`);
        finish({ ok:false, error:`Worker returned invalid JSON: ${err.message}`, stdout, stderr, exitCode:code });
      }
    });
    child.stdin.on('error',()=>{/* cancelled child may close stdin */});
    if(!cancelled)child.stdin.end(JSON.stringify(input));
  });
}
