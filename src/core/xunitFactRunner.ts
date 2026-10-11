import fs = require('node:fs');
import path = require('node:path');
import { createHash } from 'node:crypto';
import { runProcess } from './process';
import { XunitFactTarget } from './backendSituationRun';
import { XunitTheoryTarget } from './xunitTheoryRun';
import { VitestRunResult } from './vitestSituationRunner';

const inside=(root:string,target:string)=>{
  const rel=path.relative(root,target);
  return rel===''||(rel!=='..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel));
};
const physical=(file:string)=>fs.realpathSync.native(file).replace(/\\/g,'/').toLowerCase();
const digest=(file:string)=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const failure=(target:XunitCaseTarget,message:string):VitestRunResult=>({
  status:'error',message,testName:'displayName' in target?target.displayName:target.fullName,executed:0,
});
export type XunitCaseTarget = XunitFactTarget | XunitTheoryTarget;
export interface XunitListEntry {
  Assembly:string; DisplayName:string; ID:string; Class:string; Method:string;
}
export function findExactXunitFact(
  list:readonly XunitListEntry[],target:XunitFactTarget,assembly:string,
):XunitListEntry|undefined {
  try {
    const inAssembly=list.filter(item=>physical(item.Assembly)===physical(assembly));
    // Native -id selection MUST map to exactly one discovered display name,
    // method and ID. Do not resolve by substring or Theory data labels.
    const names=inAssembly.filter(item=>item.DisplayName===target.fullName);
    if(names.length!==1) return undefined;
    const row=names[0];
    if(row.Class!==target.className||row.Method!==target.methodName ||
      !/^[a-fA-F0-9]{64}$/.test(row.ID) ||
      inAssembly.filter(other=>other.ID===row.ID).length!==1) return undefined;
    return row;
  } catch {return undefined;}
}
// Unlike materializer's IXunitTest.UniqueID, a native pre-enumerated
// case ID is obtained ONLY from fresh -list full/json discovery.
export function findExactXunitTheory(
  list:readonly XunitListEntry[],target:XunitTheoryTarget,assembly:string,
):XunitListEntry|undefined {
  try {
    const scoped=list.filter(item=>physical(item.Assembly)===physical(assembly));
    const matching=scoped.filter(item=>
      item.DisplayName===target.displayName&&
      item.Class===target.className&&item.Method===target.methodName);
    if(matching.length!==1 ||
       scoped.filter(item=>item.DisplayName===target.displayName).length!==1)
      return undefined;
    const row=matching[0];
    if(!/^[0-9a-f]{64}$/i.test(row.ID) ||
       scoped.filter(item=>item.ID===row.ID).length!==1)
      return undefined;
    return row;
  }catch{return undefined;}
}

export function validateXunitAutomatedRun(
  stdout:string,selectedId:string,exitCode:number|null,
):{status:'passed'|'failed'|'error';executed:number;message:string} {
  try {
    const records=stdout.split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
    const completed=records.filter(row=>row.$type==='test-assembly-finished');
    const testEvents=records.filter(row=>['test-passed','test-failed','test-skipped',
      'test-not-run'].includes(row.$type));
    if(completed.length!==1||testEvents.length!==1)
      throw Error('runner did not execute exactly one test');
    const finished=completed[0],event=testEvents[0];
    if(event.TestCaseUniqueID!==selectedId || finished.TestsTotal!==1 ||
       finished.TestsSkipped!==0 || finished.TestsNotRun!==0)
      throw Error('runner result does not match exact requested Fact ID');
    if(event.$type==='test-passed' && finished.TestsFailed===0 && exitCode===0)
      return {status:'passed',executed:1,message:'Selected xUnit Fact passed'};
    if(event.$type==='test-failed' && finished.TestsFailed===1 && exitCode!==0)
      return {status:'failed',executed:1,message:'Selected xUnit Fact failed'};
    throw Error('runner result counters disagree with selected test outcome');
  }catch(e:any) {
    return {status:'error',executed:0,message:e?.message??'invalid xUnit run report'};
  }
}
export async function runExactXunitCase(
  target:XunitCaseTarget, buildTimeoutMs:number, runTimeoutMs:number,
  log?:(message:string)=>void,
):Promise<VitestRunResult> {
  const error=(message:string)=>failure(target,message);
  if(!Number.isSafeInteger(buildTimeoutMs)||buildTimeoutMs<1000||buildTimeoutMs>600000 ||
     !Number.isSafeInteger(runTimeoutMs)||runTimeoutMs<1000||runTimeoutMs>600000)
    return error('invalid xUnit build/run timeout');
  const project=path.resolve(target.frameworkProject);
  const source=path.resolve(target.sourceFile);
  const projectFile=path.resolve(target.projectFile);
  const assembly=path.join(project,'bin','Release','net8.0',
    path.basename(projectFile,'.csproj')+'.dll');
  let beforeSource:string,beforeProject:string;
  try {
    if(!inside(target.workspaceRoot,project)||!inside(project,source)||
      !inside(project,projectFile)||!inside(project,assembly)||
      !fs.statSync(projectFile).isFile()||!fs.statSync(source).isFile()||
      physical(project).startsWith(physical(target.workspaceRoot)+'/')===false||
      physical(source).startsWith(physical(project)+'/')===false||
      physical(projectFile).startsWith(physical(project)+'/')===false)
      return error('xUnit source/project path escapes trusted workspace');
    beforeSource=digest(source);beforeProject=digest(projectFile);
  }catch {return error('xUnit source/project file unavailable or unsafe');}
  const unchanged=()=>{
    try {return digest(source)===beforeSource&&digest(projectFile)===beforeProject;}
    catch{return false;}
  };
  const built=await runProcess('dotnet',
    ['build',projectFile,'-c','Release','--nologo'],project,buildTimeoutMs,
    {label:'p4-xunit-build',log});
  if(!built.ok||!unchanged()) return error('xUnit build failed or source changed');
  try{
    if(!fs.statSync(assembly).isFile()||
       !physical(assembly).startsWith(physical(project)+'/'))
      return error('xUnit assembly not inside project output');
  }catch{return error('xUnit assembly missing after build');}
  const isTheory='displayName' in target;
  const theoryOption=isTheory?['-preEnumerateTheories']:[];
  const listed=await runProcess('dotnet',[assembly,'-list','full/json','-noLogo',...theoryOption],
    project,runTimeoutMs,{label:'p4-xunit-discover',log});
  if(!listed.ok||!unchanged()) return error('xUnit discovery failed or inputs changed');
  let selected:XunitListEntry|undefined;
  try {
    const parsed=JSON.parse(listed.value??'');
    if(!Array.isArray(parsed)) return error('xUnit discovery did not return a list');
    selected=isTheory?findExactXunitTheory(parsed,target,assembly)
      :findExactXunitFact(parsed,target,assembly);
  } catch{return error('xUnit discovery output is not valid JSON');}
  if(!selected) return error('selected xUnit case was not uniquely pre-enumerated');
  // Native -id is case identity based (not method-name pattern). Preflight
  // proves that this ID maps to exactly the planned direct Fact.
  if(!unchanged()) return error('xUnit source changed after discovery');
  const executed=await runProcess('dotnet',
    [assembly,'-id',selected.ID,...theoryOption,'-automated','-noLogo','-noColor'],
    project,runTimeoutMs,{label:'p4-xunit-exact',log});
  if(executed.timedOut||!unchanged()) return error('xUnit timed out or inputs changed while running');
  const checked=validateXunitAutomatedRun(executed.stdout??'',selected.ID,executed.exitCode??null);
  return {...checked,
    message:isTheory?checked.message.replace('Fact','Theory row'):checked.message,
    testName:isTheory?target.displayName:target.fullName};
}

// Source compatibility for the already verified direct Fact adapter.
export const runExactXunitFact=runExactXunitCase;
