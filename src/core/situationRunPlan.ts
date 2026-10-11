import path = require('node:path');
import { FrameworkConcreteCase, JoinedSituation, PartRole, PrototypeConfig, TestDefinition } from './types';
import { situationTestId } from './testingTree';

export interface VitestSituationTarget {
  adapter: 'vitest-5';
  featureSpaceId: string;
  sourceId: string;
  workspaceRoot: string;
  frameworkProject: string;
  sourceFile: string;
  sourceLine: number;
  sourceColumn?: number;
  testName: string;
  configFile?: string;
}
export interface SituationRunPlanInput {
  workspaceRoot: string;
  config: PrototypeConfig;
  joined: JoinedSituation[];
  definitions: TestDefinition[];
  cases: FrameworkConcreteCase[];
  situationId: string;
  role: PartRole;
  trusted: boolean;
  fresh: boolean;
  dirtyFilesKnownClean: boolean;
}
function inside(root:string,child:string):boolean {
  const rel=path.relative(root,child);
  return rel==='' || (rel!=='..' && !rel.startsWith('..'+path.sep) && !path.isAbsolute(rel));
}
function refuse(reason:string):never { throw new Error('Run Situation refused: '+reason); }
function sameFile(a:string,b:string):boolean {
  const p=process.platform==='win32'
    ? (v:string)=>path.resolve(v).toLowerCase() : (v:string)=>path.resolve(v);
  return p(a)===p(b);
}
function sameDefinitionRef(a:TestDefinition['definitionRef'],b:FrameworkConcreteCase['definitionRef']):boolean {
  return a.adapterId===b.adapterId &&
    a.frameworkDefinitionKey===b.frameworkDefinitionKey &&
    sameFile(a.sourceFile,b.sourceFile) &&
    a.sourceLine===b.sourceLine &&
    a.frameworkProject!==undefined && b.frameworkProject!==undefined &&
    sameFile(a.frameworkProject,b.frameworkProject);
}
// Planning is pure, and never starts a worker. The runner validates again
// against a fresh Vitest collection before executing user tests.
export function planVitestSituationRun(input:SituationRunPlanInput):VitestSituationTarget {
  if (!input.trusted || !input.fresh || !input.dirtyFilesKnownClean)
    refuse('requires a trusted, Fresh projection and no unsaved project files');
  if (input.role!=='frontend') refuse('first P4 slice supports Frontend/Vitest only');
  const rows=input.joined.filter(row=>situationTestId(row)===input.situationId);
  if(rows.length!==1) refuse('unknown or ambiguous scoped Situation');
  const row=rows[0];
  const part=row.frontend;
  if(!part || part.trust!=='trusted' ||
    part.diagnostics.some(d=>d.projectionImpact==='blocks-part'))
    refuse('Frontend part is missing, degraded or blocked');
  const definitions=input.definitions.filter(d=>
    d.adapterId==='vitest-5' && d.partRole==='frontend' &&
    d.featureSpaceId===row.featureSpaceId &&
    d.logicalFolderKey===row.logicalFolderKey &&
    d.featureName===row.featureName && d.outcome===row.outcome &&
    d.expectedBehavior===part.expectedBehavior &&
    sameFile(d.source.file,part.source.file) &&
    d.source.line===part.source.line &&
    !d.diagnostics.some(diag=>diag.projectionImpact==='blocks-part'));
  if(definitions.length!==1) refuse('cannot locate one exact static TestDefinition');
  const d=definitions[0];
  let title:string;
  if(d.isParameterized){
    const matches=input.cases.filter(c=>
      sameDefinitionRef(d.definitionRef,c.definitionRef) &&
      c.situationId===row.situation &&
      !c.diagnostics.some(diag=>diag.projectionImpact==='blocks-part'));
    if(matches.length!==1 || !matches[0].displayName)
      refuse('parameterized concrete case is missing or ambiguous');
    title=matches[0].displayName!;
  } else {
    if(d.directSituation!==row.situation)
      refuse('static Situation does not match the selected part');
    title=[row.featureName,row.outcome,row.situation,part.expectedBehavior].join('__');
  }
  if(!title || title.length>4096) refuse('invalid or unbounded test title');
  const root=path.resolve(input.workspaceRoot);
  const sources=input.config.featureSpaces.filter(s=>s.id===row.featureSpaceId)
    .flatMap(s=>s.sources).filter(s=>s.role==='frontend'&&s.adapter==='vitest-5');
  const matched=sources.filter(s=>{
    const project=path.resolve(root,s.frameworkProject);
    const sourceRoot=path.resolve(root,s.root);
    return inside(root,project)&&inside(project,sourceRoot)&&
      inside(sourceRoot,path.resolve(d.source.file)) &&
      sameFile(project,d.frameworkProject);
  });
  if(matched.length!==1) refuse('framework or source scope not unique and contained');
  const source=matched[0];
  const project=path.resolve(root,source.frameworkProject);
  const file=path.resolve(d.source.file);
  if(!inside(project,file) || !inside(root,file))
    refuse('source path escapes trusted workspace');
  const configFile=source.configFile
    ? path.resolve(project,source.configFile):undefined;
  if(configFile && !inside(project,configFile))
    refuse('Vitest configuration escapes framework project');
  return {
    adapter:'vitest-5',featureSpaceId:row.featureSpaceId,sourceId:source.id,
    workspaceRoot:root,frameworkProject:project,sourceFile:file,
    sourceLine:d.definitionRef.frameworkTaskLine??d.source.line,
    sourceColumn:d.definitionRef.frameworkTaskColumn,
    testName:title,configFile,
  };
}
