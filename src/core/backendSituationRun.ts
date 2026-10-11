import path = require('node:path');
import { SituationRunPlanInput } from './situationRunPlan';
import { situationTestId } from './testingTree';

export interface XunitFactTarget {
  adapter:'xunit-v3';
  workspaceRoot:string;
  featureSpaceId:string;
  sourceId:string;
  frameworkProject:string;
  projectFile:string;
  sourceFile:string;
  methodName:string;
  className:string;
  fullName:string;
}
const inside=(root:string,target:string)=>{
  const rel=path.relative(root,target);
  return rel==='' || (rel!=='..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel));
};
const same=(a:string,b:string)=>{
  const p=(x:string)=>process.platform==='win32'
    ? path.resolve(x).toLowerCase():path.resolve(x);
  return p(a)===p(b);
};
const refuse=(message:string):never=>{throw Error('Run Backend refused: '+message);};

export function planXunitFactRun(input:SituationRunPlanInput):XunitFactTarget {
  if(input.role!=='backend'||!input.trusted||!input.fresh||!input.dirtyFilesKnownClean)
    refuse('requires exactly one trusted, Fresh Backend Situation and saved files');
  const rows=input.joined.filter(row=>situationTestId(row)===input.situationId);
  if(rows.length!==1) refuse('unknown or duplicated scoped Situation');
  const row=rows[0],part=row.backend;
  if(!part) throw Error('Run Backend refused: Backend part missing');
  if(part.trust!=='trusted'||part.diagnostics.some(d=>d.projectionImpact==='blocks-part'))
    refuse('Backend part degraded or blocked');
  const defs=input.definitions.filter(d=>d.adapterId==='xunit-v3'&&d.partRole==='backend'&&
    d.featureSpaceId===row.featureSpaceId&&d.logicalFolderKey===row.logicalFolderKey&&
    d.featureName===row.featureName&&d.outcome===row.outcome&&
    d.expectedBehavior===part.expectedBehavior&&same(d.source.file,part.source.file)&&
    d.source.line===part.source.line&&!d.diagnostics.some(diag=>diag.projectionImpact==='blocks-part'));
  if(defs.length!==1) refuse('cannot resolve exactly one Backend TestDefinition');
  const definition=defs[0];
  // xUnit 4.0.1 native discovery folds certain Theory rows into a parent case.
  // Its -id and -filter options do NOT safely address the individual row.
  if(definition.isParameterized) refuse('parameterized xUnit Theory row cannot be executed individually');
  if(definition.directSituation!==row.situation)
    refuse('direct xUnit Situation identity mismatch');
  const key=definition.definitionRef.frameworkDefinitionKey;
  const match=/^([\w.+]+)\.([A-Za-z_][A-Za-z_0-9]*)\(\)$/.exec(key);
  if(!match) throw Error('Run Backend refused: xUnit Fact method signature is not exactly resolvable');
  const workspace=path.resolve(input.workspaceRoot);
  const sources=input.config.featureSpaces.filter(s=>s.id===row.featureSpaceId)
    .flatMap(s=>s.sources).filter(s=>s.adapter==='xunit-v3'&&s.role==='backend'&&s.projectFile);
  const matching=sources.filter(s=>{
    const project=path.resolve(workspace,s.frameworkProject);
    const sourceRoot=path.resolve(workspace,s.root);
    const file=path.resolve(definition.source.file);
    return inside(workspace,project)&&inside(project,sourceRoot)&&inside(sourceRoot,file)&&
      same(project,definition.frameworkProject);
  });
  if(matching.length!==1) refuse('configured backend project/scope missing or ambiguous');
  const source=matching[0];
  const project=path.resolve(workspace,source.frameworkProject);
  const projectFile=path.resolve(project,source.projectFile!);
  if(!inside(project,projectFile)||!projectFile.endsWith('.csproj'))
    refuse('project file outside backend project');
  return {adapter:'xunit-v3',workspaceRoot:workspace,
    featureSpaceId:row.featureSpaceId,sourceId:source.id,frameworkProject:project,
    projectFile,sourceFile:path.resolve(definition.source.file),
    className:match[1],methodName:match[2],fullName:match[1]+'.'+match[2]};
}
