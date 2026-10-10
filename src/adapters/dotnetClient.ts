import path = require('node:path');
import { Diagnostic, FeatureSourceConfig, FrameworkConcreteCase, TestDefinition } from '../core/types';
import { parseDescription } from '../core/naming';
import { runJsonWorker, runProcess, WorkerResult } from '../core/process';

interface RawDotnetDefinition {
  id: string;
  featureSpaceId: string;
  logicalFolderKey: string;
  partRole: 'frontend'|'backend';
  adapterId: string;
  frameworkProject: string;
  isParameterized: boolean;
  rawDescription: string;
  assertions: any[];
  source: any;
  definitionRef: any;
  caseSourceAnchors?: any[];
  diagnostics?: any[];
}
interface DotnetAnalysisResponse { definitions: RawDotnetDefinition[]; diagnostics?: any[]; }
interface DotnetMaterializeResponse { cases: any[]; diagnostics?: any[]; }

function normalizeDiagnostic(raw: any, defaults: Partial<Diagnostic> = {}): Diagnostic {
  const category = raw?.category === 'projection-safety' || raw?.category === 'test-quality' || raw?.category === 'runtime'
    ? raw.category
    : (defaults.category ?? 'runtime');
  const severity = raw?.severity === 'error' || raw?.severity === 'warning' || raw?.severity === 'info'
    ? raw.severity
    : (defaults.severity ?? 'error');
  const projectionImpact = raw?.projectionImpact === 'blocks-part' || raw?.projectionImpact === 'degrades-part' || raw?.projectionImpact === 'none'
    ? raw.projectionImpact
    : (defaults.projectionImpact ?? 'blocks-part');
  return {
    ruleId: String(raw?.ruleId ?? defaults.ruleId ?? 'worker/unknown-diagnostic'),
    category,
    severity,
    projectionImpact,
    message: String(raw?.message ?? defaults.message ?? 'Unknown .NET worker diagnostic'),
    source: raw?.source ?? defaults.source,
  };
}

export function normalizeDotnetDefinitions(raw: RawDotnetDefinition[]): TestDefinition[] {
  return raw.map(r => {
    const parsed = parseDescription(r.rawDescription, r.isParameterized);
    return {
      id:r.id, featureSpaceId:r.featureSpaceId, logicalFolderKey:r.logicalFolderKey,
      partRole:r.partRole, adapterId:r.adapterId, frameworkProject:r.frameworkProject,
      isParameterized:r.isParameterized, featureName:parsed.featureName, outcome:parsed.outcome,
      directSituation:parsed.situation, expectedBehavior:parsed.expectedBehavior,
      assertions:r.assertions, source:r.source, definitionRef:r.definitionRef,
      caseSourceAnchors:r.caseSourceAnchors ?? [],
      diagnostics:[...(r.diagnostics ?? []).map(d => normalizeDiagnostic(d)), ...parsed.diagnostics.map(d => ({...d, source:r.source}))],
    };
  });
}

function normalizeConcreteCases(rawCases: any[]): FrameworkConcreteCase[] {
  return (rawCases ?? []).map(raw => ({
    definitionRef: raw.definitionRef,
    frameworkCaseId: String(raw.frameworkCaseId),
    situationId: raw.situationId,
    displayName: raw.displayName,
    diagnostics: (raw.diagnostics ?? []).map((d: any) => normalizeDiagnostic(d)),
  }));
}

function absSource(source: FeatureSourceConfig, workspaceRoot: string) {
  return {
    ...source,
    root:path.resolve(workspaceRoot,source.root),
    frameworkProject:path.resolve(workspaceRoot,source.frameworkProject),
    projectFile:source.projectFile ? path.resolve(workspaceRoot,source.frameworkProject,source.projectFile) : undefined,
  };
}

export async function analyzeDotnet(
  source: FeatureSourceConfig,
  featureSpaceId: string,
  workspaceRoot: string,
  workerDll: string,
  timeoutMs: number,
  log?: (message:string) => void,
): Promise<WorkerResult<{definitions:TestDefinition[], diagnostics?:Diagnostic[]}>> {
  const result = await runJsonWorker<DotnetAnalysisResponse>('dotnet', [workerDll], { command:'analyze', featureSpaceId, source:absSource(source,workspaceRoot) }, workspaceRoot, timeoutMs, {
    label:`dotnet-analyze:${source.id}`,
    log,
  });
  if (!result.ok || !result.value) return result as any;
  return {
    ...result,
    value:{
      definitions:normalizeDotnetDefinitions(result.value.definitions ?? []),
      diagnostics:(result.value.diagnostics ?? []).map(d => normalizeDiagnostic(d)),
    },
  };
}

export async function buildDotnetProject(
  source: FeatureSourceConfig,
  workspaceRoot: string,
  timeoutMs: number,
  log?: (message:string) => void,
) {
  if (!source.projectFile) return { ok:false, error:'projectFile is required for xUnit project build' } as WorkerResult<string>;
  const absolute = absSource(source, workspaceRoot);
  return runProcess('dotnet', ['build', absolute.projectFile!, '-c', 'Release', '--nologo'], absolute.frameworkProject, timeoutMs, {
    label:`dotnet-build:${source.id}`,
    log,
  });
}

export async function materializeXunit(
  source: FeatureSourceConfig,
  featureSpaceId: string,
  workspaceRoot: string,
  workerDll: string,
  timeoutMs: number,
  log?: (message:string) => void,
): Promise<WorkerResult<{cases:FrameworkConcreteCase[], diagnostics?:Diagnostic[]}>> {
  const result = await runJsonWorker<DotnetMaterializeResponse>('dotnet', [workerDll], { command:'materialize-xunit', featureSpaceId, source:absSource(source,workspaceRoot) }, workspaceRoot, timeoutMs, {
    label:`xunit-materialize:${source.id}`,
    log,
  });
  if (!result.ok || !result.value) return result as any;
  return {
    ...result,
    value:{
      cases:normalizeConcreteCases(result.value.cases ?? []),
      diagnostics:(result.value.diagnostics ?? []).map(d => normalizeDiagnostic(d)),
    },
  };
}
