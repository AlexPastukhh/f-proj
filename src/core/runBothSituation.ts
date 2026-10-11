import { SituationRunPlanInput, planVitestSituationRun, VitestSituationTarget } from './situationRunPlan';
import { planXunitFactRun, XunitFactTarget } from './backendSituationRun';
import { VitestRunResult } from './vitestSituationRunner';

export interface RunBothPlan {
  frontend:VitestSituationTarget;
  backend:XunitFactTarget;
}
// Both sides MUST be planned before any test code is executed.
// First slice: direct Backend Fact only; folded/non-pre-enumerable Theory
// may not be launched speculatively after Frontend.
export function planRunBoth(
  input:Omit<SituationRunPlanInput,'role'>,
):RunBothPlan {
  const frontend=planVitestSituationRun({...input,role:'frontend'});
  const backend=planXunitFactRun({...input,role:'backend'});
  if(frontend.featureSpaceId!==backend.featureSpaceId)
    throw Error('Run Both refused: Frontend and Backend scopes disagree');
  return {frontend,backend};
}
export type RunBothStage='frontend'|'backend';
export interface RunBothOutcome {
  status:'passed'|'failed'|'error';
  message:string;
  frontend?:VitestRunResult;
  backend?:VitestRunResult;
}
export interface RunBothHooks {
  frontend:(plan:VitestSituationTarget)=>Promise<VitestRunResult>;
  backend:(plan:XunitFactTarget)=>Promise<VitestRunResult>;
  valid:()=>boolean;
  started?:(stage:RunBothStage)=>void;
  finished?:(stage:RunBothStage,result:VitestRunResult)=>void;
}
const error=(reason:string,frontend?:VitestRunResult):RunBothOutcome=>({
  status:'error',message:reason,frontend,
});
export async function executeRunBoth(plan:RunBothPlan,hooks:RunBothHooks):Promise<RunBothOutcome> {
  if(!hooks.valid()) return error('Run Both refused: state changed before execution');
  let frontend:VitestRunResult;
  try {
    hooks.started?.('frontend');
    frontend=await hooks.frontend(plan.frontend);
    hooks.finished?.('frontend',frontend);
  } catch(err:any) {
    return error('Frontend runner threw: '+(err?.message??String(err)));
  }
  if(!hooks.valid()) return error('Run Both stopped: state changed after Frontend',frontend);
  if(frontend.status==='error'||frontend.executed!==1)
    return error('Run Both stopped: Frontend exact run failed validation',frontend);
  // A genuine test failure does NOT prevent the independent Backend test.
  if(!hooks.valid()) return error('Run Both stopped: state changed before Backend',frontend);
  let backend:VitestRunResult;
  try {
    hooks.started?.('backend');
    backend=await hooks.backend(plan.backend);
    hooks.finished?.('backend',backend);
  }catch(err:any){
    return error('Backend runner threw: '+(err?.message??String(err)),frontend);
  }
  if(!hooks.valid()) return {status:'error',
    message:'Run Both stopped: state changed after Backend',frontend,backend};
  if(backend.status==='error'||backend.executed!==1) return {
    status:'error',message:'Run Both stopped: Backend exact run failed validation',
    frontend,backend,
  };
  const failed=frontend.status==='failed'||backend.status==='failed';
  return {status:failed?'failed':'passed',
    message:failed?'One or both selected tests failed':'Both selected tests passed',
    frontend,backend};
}
