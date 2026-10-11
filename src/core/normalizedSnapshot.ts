import fs = require('node:fs');
import path = require('node:path');
import { Diagnostic, FeaturePartScenario, JoinedSituation, SourceRange, TestDefinition } from './types';

// Internal feasibility model only. Deliberately NO public schema version or file export.
export interface NormalizedSource {
  file: string; // POSIX-separated workspace-relative path; no absolute checkout leak
  start: number;
  end: number;
  line: number;
  column: number;
}
export interface NormalizedDiagnostic {
  ruleId: string;
  category: Diagnostic['category'];
  severity: Diagnostic['severity'];
  projectionImpact: Diagnostic['projectionImpact'];
  message: string;
  source: NormalizedSource | null;
}
export interface NormalizedPart {
  role: 'frontend' | 'backend';
  expectedBehavior: string;
  trust: 'trusted' | 'degraded';
  source: NormalizedSource;
  navigationSource: NormalizedSource;
  assertions: {kind:'assertion'|'responsibility';sourceCode:string;source:NormalizedSource}[];
  diagnostics: NormalizedDiagnostic[];
}
export interface NormalizedSituation {
  featureScope: {featureSpaceId:string;logicalFolderKey:string};
  featureName: string;
  outcome: string;
  situation: string;
  frontend: NormalizedPart | null;
  backend: NormalizedPart | null;
}
export interface NormalizedUnresolved {
  id: string;
  featureSpaceId: string;
  logicalFolderKey: string;
  featureName: string | null;
  outcome: string | null;
  role: 'frontend' | 'backend';
  source: NormalizedSource;
  diagnostics: NormalizedDiagnostic[];
}
export interface NormalizedSnapshot {
  experimental: true;
  situations: NormalizedSituation[];
  unresolved: NormalizedUnresolved[];
  diagnostics: NormalizedDiagnostic[];
}

const cmp = (a:string,b:string):number => a < b ? -1 : a > b ? 1 : 0;
function strictSource(root:string, value:SourceRange):NormalizedSource {
  if (!value || typeof value.file !== 'string' || !path.isAbsolute(value.file))
    throw new Error('Normalized source requires an absolute physical file path');
  const file = fs.realpathSync(value.file);
  const rel = path.relative(root,file);
  if (!rel || rel === '..' || rel.startsWith('..'+path.sep) || path.isAbsolute(rel))
    throw new Error('Normalized source escapes the trusted workspace');
  if (![value.start,value.end,value.line,value.column].every(Number.isSafeInteger) ||
      value.start < 0 || value.end < value.start || value.line < 1 || value.column < 1)
    throw new Error('Normalized source has invalid coordinates');
  return {file:rel.split(path.sep).join('/'),start:value.start,end:value.end,
    line:value.line,column:value.column};
}
function snapshotDiagnostic(root:string, d:Diagnostic):NormalizedDiagnostic {
  if (!d || !d.ruleId || !d.message)
    throw new Error('Normalized diagnostic is incomplete');
  return {ruleId:d.ruleId,category:d.category,severity:d.severity,
    projectionImpact:d.projectionImpact,message:d.message,
    source:d.source ? strictSource(root,d.source) : null};
}
function sortedDiagnostics(root:string, input:Diagnostic[]):NormalizedDiagnostic[] {
  return input.map(d=>snapshotDiagnostic(root,d)).sort((a,b) =>
    cmp(JSON.stringify(a),JSON.stringify(b)));
}
function snapshotPart(root:string,row:JoinedSituation,
  role:'frontend'|'backend',part:FeaturePartScenario|undefined):NormalizedPart|null {
  if (!part) return null; // unmatched is not inferred into a fake part
  for (const field of ['featureSpaceId','logicalFolderKey','featureName','outcome','situation'] as const) {
    if (row[field] !== part[field]) throw new Error('Part identity escapes its exact Situation');
  }
  if (part.partRole !== role || !part.expectedBehavior ||
      !['trusted','degraded'].includes(part.trust))
    throw new Error('Part role, behavior or trust is inconsistent');
  return {role,expectedBehavior:part.expectedBehavior,trust:part.trust,
    source:strictSource(root,part.source),
    navigationSource:strictSource(root,part.navigationSource ?? part.source),
    assertions:part.assertions.map(a => ({
      kind:a.kind,sourceCode:a.sourceCode,source:strictSource(root,a.source),
    })),
    diagnostics:sortedDiagnostics(root,part.diagnostics)};
}


function identity(row:JoinedSituation):string {
  return JSON.stringify([row.featureSpaceId,row.logicalFolderKey,
    row.featureName,row.outcome,row.situation]);
}
function representedKey(role:string,source:SourceRange):string {
  return JSON.stringify([role,source.file,source.line]);
}

// No file writes, external workers, timestamps or public JSON/schema promise.
// An ambiguous input must be refused rather than reported as authoritative.
export function buildExperimentalSnapshot(
  workspaceRoot:string, joined:JoinedSituation[], definitions:TestDefinition[],
  diagnostics:Diagnostic[],
): NormalizedSnapshot {
  const root = fs.realpathSync(workspaceRoot);
  const seen = new Set<string>();
  const represented = new Set<string>();
  const situations = [...joined].sort((a,b)=>cmp(identity(a),identity(b))).map(row => {
    for(const key of ['featureSpaceId','logicalFolderKey','featureName','outcome','situation'] as const) {
      if (typeof row[key] !== 'string' || !row[key])
        throw new Error('Normalized Situation identity cannot be empty');
    }
    const key = identity(row);
    if (seen.has(key)) throw new Error('Duplicate normalized Situation identity');
    seen.add(key);
    for(const part of [row.frontend,row.backend]) {
      if (part) represented.add(representedKey(part.partRole,part.source));
    }
    return {
      featureScope:{featureSpaceId:row.featureSpaceId,logicalFolderKey:row.logicalFolderKey},
      featureName:row.featureName,outcome:row.outcome,situation:row.situation,
      frontend:snapshotPart(root,row,'frontend',row.frontend),
      backend:snapshotPart(root,row,'backend',row.backend),
    };
  });
  const unresolved:NormalizedUnresolved[] = definitions
    .filter(d=>d.isParameterized && !represented.has(representedKey(d.partRole,d.source)))
    .map(d=>({
      id:d.id,featureSpaceId:d.featureSpaceId,logicalFolderKey:d.logicalFolderKey,
      featureName:d.featureName ?? null,outcome:d.outcome ?? null,role:d.partRole,
      source:strictSource(root,d.source),diagnostics:sortedDiagnostics(root,d.diagnostics),
    }))
    .sort((a,b)=>cmp(JSON.stringify([
      a.featureSpaceId,a.logicalFolderKey,a.featureName,a.outcome,a.role,a.id,
    ]),JSON.stringify([
      b.featureSpaceId,b.logicalFolderKey,b.featureName,b.outcome,b.role,b.id,
    ])));
  const unresolvedKeys = unresolved.map(d=>JSON.stringify([
    d.featureSpaceId,d.logicalFolderKey,d.role,d.id,
  ]));
  if(new Set(unresolvedKeys).size !== unresolvedKeys.length)
    throw new Error('Ambiguous unresolved TestDefinition identity');
  return {experimental:true,situations,unresolved,
    diagnostics:sortedDiagnostics(root,diagnostics)};
}
export function serializeExperimentalSnapshot(snapshot:NormalizedSnapshot):string {
  if(snapshot.experimental !== true)
    throw new Error('Public or unverified normalized JSON contract is not supported');
  return JSON.stringify(snapshot,null,2)+'\n';
}
