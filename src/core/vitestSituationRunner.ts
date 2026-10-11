import fs = require('node:fs');
import os = require('node:os');
import path = require('node:path');
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { runJsonWorker, runProcess } from './process';
import { NodeWorkerRuntime } from '../adapters/vitestMaterializer';
import { VitestSituationTarget } from './situationRunPlan';

interface CollectedCase {
  moduleId:string;
  sourceLine:number;
  sourceColumn:number;
  displayName?:string;
  frameworkCaseId:string;
}
interface Collected { cases:CollectedCase[]; diagnostics?:Array<{message:string}>; }
export interface VitestRunResult {
  status:'passed'|'failed'|'error';
  message:string;
  executed:number;
  testName:string;
}
const contained=(root:string,child:string)=>{
  const rel=path.relative(root,child);
  return rel===''|| (rel!=='..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel));
};
const canonical=(file:string)=>{
  const value=fs.realpathSync.native(file);
  return process.platform==='win32'?value.toLowerCase():value;
};
const escaped=(name:string)=>name.replace(/[.*+?^$\{\}()|[\]\\]/g,'\\$&');
const digest=(file:string)=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
export function hasUniqueCollectedVitestTarget(
  cases:readonly CollectedCase[],target:VitestSituationTarget,
):boolean {
  try {
    const sameNamed=cases.filter(c=>
      c.displayName===target.testName &&
      canonical(c.moduleId)===canonical(target.sourceFile));
    return sameNamed.length===1 &&
      Number(sameNamed[0].sourceLine)===target.sourceLine &&
      (target.sourceColumn===undefined ||
       Number(sameNamed[0].sourceColumn)===target.sourceColumn);
  } catch { return false; }
}
const fail=(reason:string):VitestRunResult=>({
  status:'error',message:reason,executed:0,testName:'',
});
// P4.1 runs only after an explicit caller request; no watch/Refresh invocation.
export async function runExactVitestSituation(
  target:VitestSituationTarget,
  workerPath:string,
  timeoutMs:number,
  runtime:NodeWorkerRuntime,
  log?:(message:string)=>void,
  signal?:AbortSignal,
):Promise<VitestRunResult> {
  const error=(reason:string)=>({...fail(reason),testName:target.testName});
  if(signal?.aborted)return error('selected Vitest test cancelled before launch');
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>600000)
    return error('invalid test-run timeout');
  let original:string,cli:string,project:string;
  try {
    project=path.resolve(target.frameworkProject);
    const file=path.resolve(target.sourceFile);
    if(!contained(project,file) || !fs.statSync(file).isFile())
      return error('test file missing or outside framework project');
    if(!contained(canonical(path.resolve(target.workspaceRoot)),canonical(project)))
      return error('framework project real path escapes trusted workspace');
    if(!contained(canonical(project),canonical(file)))
      return error('linked test file escapes framework project');
    if(target.configFile && !contained(canonical(project),canonical(target.configFile)))
      return error('Vitest config real path escapes framework project');
    original=digest(file);
    const requireFromHere=createRequire(__filename);
    cli=path.join(path.dirname(requireFromHere.resolve('vitest/package.json',
      {paths:[project]})),'vitest.mjs');
    if(!fs.statSync(cli).isFile()) return error('Vitest CLI unavailable');
  } catch(e:any){ return error('runner prerequisites unavailable: '+(e?.message??e)); }
  const collected=await runJsonWorker<Collected>(
    runtime.command,[...(runtime.argsPrefix??[]),workerPath],{
      frameworkProject:project,filters:[target.sourceFile],
      configFile:target.configFile,
    },project,timeoutMs,{env:runtime.env,label:'p4-vitest-collect',log,signal});
  if(signal?.aborted||collected.cancelled)return error('Vitest collection cancelled');
  if(!collected.ok || !collected.value || collected.value.diagnostics?.length)
    return error('fresh Vitest collection failed or returned diagnostics');
  // Name filtering drives execution: duplicates at OTHER source lines must
  // also refuse, or Vitest would run several tests before report validation.
  if(!hasUniqueCollectedVitestTarget(collected.value.cases,target))
    return error('exact test identity absent or ambiguous in fresh Vitest collection');
  try {
    if(digest(target.sourceFile)!==original)
      return error('test source changed during collection');
  }catch{ return error('test source disappeared during collection'); }
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'feature-projection-run-'));
  try {
    const reportFile=path.join(directory,'result.json');
    const args=[...(runtime.argsPrefix??[]),cli,'run',target.sourceFile,
      '--testNamePattern','^'+escaped(target.testName)+'$',
      '--reporter=json','--outputFile',reportFile,'--no-file-parallelism'];
    if(target.configFile) args.push('--config',target.configFile);
    const run=await runProcess(runtime.command,args,project,timeoutMs,{
      env:runtime.env,label:'p4-vitest-exact',log,signal});
    if(signal?.aborted||run.cancelled)return error('selected Vitest test cancelled');
    if(run.timedOut) return error('selected Vitest test timed out');
    if(!fs.existsSync(reportFile)) return error('Vitest produced no test report');
    let report:any;
    try{report=JSON.parse(fs.readFileSync(reportFile,'utf8'));}
    catch{return error('Vitest returned invalid test report');}
    const assertions=(report.testResults??[]).flatMap((m:any)=>m.assertionResults??[]);
    const executed=assertions.filter((a:any)=>a.status==='passed'||a.status==='failed');
    if(executed.length!==1||executed[0].fullName!==target.testName ||
       report.numPassedTests+report.numFailedTests!==1)
      return error('runner did not execute exactly the preflight-selected test');
    if(digest(target.sourceFile)!==original)
      return error('test source changed during execution');
    if(signal?.aborted)return error('selected Vitest test cancelled after execution');
    const only=executed[0];
    if(only.status==='passed'&&run.ok)
      return {status:'passed',message:'Selected Vitest test passed',executed:1,testName:target.testName};
    if(only.status==='failed'&&!run.ok)
      return {status:'failed',message:(only.failureMessages??[]).join('\n').slice(0,2500)||
        'Selected Vitest test failed',executed:1,testName:target.testName};
    return error('Vitest runner status and report disagree');
  }catch(e:any){return error('runner failure: '+(e?.message??e));}
  finally{fs.rmSync(directory,{recursive:true,force:true});}
}
