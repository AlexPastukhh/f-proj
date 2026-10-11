/**
 * Per-extension P4 execution gate. All explicit Test API profiles share
 * one active lease; invalidating a projection revokes the lease immediately.
 * The lease identity prevents a stale finally block releasing a newer run.
 */
export interface RunSessionLease {
  readonly signal: AbortSignal;
  readonly controller: AbortController;
  isCurrent(): boolean;
  release(): void;
}
export class RunSessionGate {
  private current?: { id:number; controller:AbortController };
  private nextId=0;

  acquire():RunSessionLease|undefined {
    if(this.current) return undefined;
    const entry={id:++this.nextId,controller:new AbortController()};
    this.current=entry;
    return {
      signal:entry.controller.signal,
      controller:entry.controller,
      isCurrent:()=>this.current===entry&&!entry.controller.signal.aborted,
      release:()=>{
        if(this.current===entry)this.current=undefined;
      },
    };
  }

  invalidate():void {
    this.current?.controller.abort();
  }

  get occupied():boolean {
    return this.current!==undefined;
  }
}
