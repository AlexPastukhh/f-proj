import path = require('node:path');
import { SituationRunPlanInput } from './situationRunPlan';
import { situationTestId } from './testingTree';
import { XunitFactTarget } from './backendSituationRun';

export interface XunitTheoryTarget extends XunitFactTarget {
  displayName:string;
  frameworkCaseId:string;
}
const inside=(root:string,target:string)=>{
  const rel=path.relative(root,target);
  return rel===''||(rel!=='..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel));
};
const same=(a:string,b:string)=>process.platform==='win32'
  ? path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase()
  : path.resolve(a)===path.resolve(b);
const refuse=(reason:string):never=>{
  throw Error('Run Backend Theory refused: '+reason);
};
// A concrete Projection case is NOT itself a native runnable xUnit case.
// The runner must independently discover one pre-enumerated native row.
export function planXunitTheoryRun(input:SituationRunPlanInput):XunitTheoryTarget {
  if(input.role!=='backend'||!input.trusted||!input.fresh||!input.dirtyFilesKnownClean)
    refuse('requires trusted, Fresh Backend and known-clean documents');
  const rows=input.joined.filter(row=>situationTestId(row)===input.situationId);
  if(rows.length!==1) refuse('missing or ambiguous scoped Situation');
  const row=rows[0],part=row.backend;
  if(!part) throw Error('Run Backend Theory refused: backend part missing');
  if(part.trust!=='trusted'||part.diagnostics.some(d=>d.projectionImpact==='blocks-part'))
    refuse('backend part degraded');
  const defs=input.definitions.filter(d=>
    d.adapterId==='xunit-v3'&&d.partRole==='backend'&&d.isParameterized&&
    d.featureSpaceId===row.featureSpaceId&&d.logicalFolderKey===row.logicalFolderKey&&
    d.featureName===row.featureName&&d.outcome===row.outcome&&
    d.expectedBehavior===part.expectedBehavior&&same(d.source.file,part.source.file)&&
    d.source.line===part.source.line&&!d.diagnostics.some(x=>x.projectionImpact==='blocks-part'));
  if(defs.length!==1) refuse('one parameterized definition not found');
  const definition=defs[0],reference=definition.definitionRef;
  const key=reference.frameworkDefinitionKey;
  const match=/^([\w.+]+)\.([A-Za-z_][A-Za-z_0-9]*)\((.+)\)$/.exec(key);
  if(!match) throw Error('Run Backend Theory refused: Theory signature unavailable');
  const concrete=input.cases.filter(c=>
    c.definitionRef.adapterId===reference.adapterId&&
    c.definitionRef.frameworkDefinitionKey===reference.frameworkDefinitionKey&&
    !!c.definitionRef.frameworkProject&&!!reference.frameworkProject&&
    same(c.definitionRef.frameworkProject,reference.frameworkProject)&&
    c.situationId===row.situation&&!c.diagnostics.some(x=>x.projectionImpact==='blocks-part'));
  if(concrete.length!==1) refuse('native materialization must contain one correlated row');
  const selected=concrete[0];
  const display=selected.displayName;
  if(!display||!(/^[0-9a-f]{64}$/i).test(selected.frameworkCaseId))
    throw Error('Run Backend Theory refused: missing materialized identity');
  const fullName=match[1]+'.'+match[2];
  if(!display.startsWith(fullName+' ')||
     !display.endsWith('['+row.situation+']'))
    refuse('materialized name does not include the exact labelled row');
  if(input.cases.filter(c=>c.displayName===selected.displayName).length!==1)
    refuse('duplicate materialized display name');
  const workspace=path.resolve(input.workspaceRoot);
  const sourceConfigs=input.config.featureSpaces.filter(s=>s.id===row.featureSpaceId)
    .flatMap(s=>s.sources).filter(s=>s.role==='backend'&&s.adapter==='xunit-v3'&&s.projectFile);
  const matches=sourceConfigs.filter(s=>{
    const project=path.resolve(workspace,s.frameworkProject);
    const sourceRoot=path.resolve(workspace,s.root);
    return inside(workspace,project)&&inside(project,sourceRoot)&&
      inside(sourceRoot,path.resolve(definition.source.file))&&same(project,definition.frameworkProject);
  });
  if(matches.length!==1) refuse('source framework project/scope is not unique');
  const source=matches[0],project=path.resolve(workspace,source.frameworkProject);
  const projectFile=path.resolve(project,source.projectFile!);
  if(!inside(project,projectFile)||!projectFile.toLowerCase().endsWith('.csproj'))
    refuse('xUnit project path escapes configured project');
  return {adapter:'xunit-v3',workspaceRoot:workspace,featureSpaceId:row.featureSpaceId,
    sourceId:source.id,frameworkProject:project,projectFile,
    sourceFile:path.resolve(definition.source.file),className:match[1],
    methodName:match[2],fullName,displayName:display,
    frameworkCaseId:selected.frameworkCaseId};
}
