import fs = require('node:fs');
import { performance } from 'node:perf_hooks';
import { analyzeVitestSource } from '../adapters/vitestSource';
import { materializeVitest, NodeWorkerRuntime } from '../adapters/vitestMaterializer';
import { analyzeDotnet, buildDotnetProject, materializeXunit } from '../adapters/dotnetClient';
import { Diagnostic, FrameworkConcreteCase, PrototypeConfig, TestDefinition } from './types';
import { validatePrototypeConfig } from './configValidation';
import { classifyDotnetPrerequisiteFailure } from './runtimePrerequisites';
import { expandDefinitions, joinParts, renderProjection } from './projection';

export interface FullRunOptions {
  workspaceRoot: string;
  config: PrototypeConfig;
  trusted: boolean;
  vitestWorkerPath: string;
  dotnetWorkerDll: string;
  vitestNodeRuntime?: NodeWorkerRuntime;
  log?: (message:string) => void;
  onTiming?: (sample: FullRunTiming) => void;
}

export interface FullRunTiming {
  phase: 'validate' | 'vitest-static' | 'vitest-materialize' | 'xunit-static' |
    'xunit-build' | 'xunit-materialize' | 'expand' | 'join' | 'render';
  elapsedMs: number;
  featureSpaceId?: string;
  sourceId?: string;
}

// Optional observation only. A broken timing sink must not affect evidence or Refresh.
function timed<T>(options:FullRunOptions, phase:FullRunTiming['phase'], action:()=>T,
  identity?:Pick<FullRunTiming,'featureSpaceId'|'sourceId'>):T {
  if (!options.onTiming) return action();
  const start=performance.now();
  try { return action(); }
  finally {
    try { options.onTiming({phase,elapsedMs:Math.max(0,performance.now()-start),...identity}); }
    catch { /* performance observation cannot fail the projection */ }
  }
}

async function timedAsync<T>(options:FullRunOptions, phase:FullRunTiming['phase'],
  action:()=>Promise<T>,identity?:Pick<FullRunTiming,'featureSpaceId'|'sourceId'>):Promise<T> {
  if (!options.onTiming) return action();
  const start=performance.now();
  try { return await action(); }
  finally {
    try { options.onTiming({phase,elapsedMs:Math.max(0,performance.now()-start),...identity}); }
    catch { /* performance observation cannot fail the projection */ }
  }
}

export function resolveXunitBuildTimeout(config: PrototypeConfig): number {
  return config.buildTimeoutMs ?? 120000;
}

function workerFailureMessage(error: string | undefined, stderr: string | undefined, fallback: string): string {
  const primary = error ?? fallback;
  const detail = stderr?.trim();
  if (!detail) return primary;
  const compact = detail.length > 800 ? `${detail.slice(0, 800)}…` : detail;
  return `${primary}: ${compact}`;
}

export async function runFullPrototype(options: FullRunOptions) {
  const definitions: TestDefinition[] = [];
  const cases: FrameworkConcreteCase[] = [];
  const runtimeDiagnostics: Diagnostic[] = [];
  const timeout = options.config.workerTimeoutMs ?? 30000;
  const buildTimeout = resolveXunitBuildTimeout(options.config);
  const log = options.log ?? (() => {});

  log(`engine: workspace=${options.workspaceRoot}`);
  log(`engine: trusted=${options.trusted}`);
  log(`engine: featureSpaces=${Array.isArray(options.config.featureSpaces) ? options.config.featureSpaces.length : 0}`);

  const validation = timed(options,'validate',()=>validatePrototypeConfig(options.config, options.workspaceRoot));
  runtimeDiagnostics.push(...validation.diagnostics);

  for (const {spaceId, source} of validation.valid) {
    log(`source:${source.id}: adapter=${source.adapter} role=${source.role} root=${source.root}`);
    if (source.adapter === 'vitest-5') {
      const defs = timed(options,'vitest-static',()=>analyzeVitestSource(source, spaceId, options.workspaceRoot),
        {featureSpaceId:spaceId,sourceId:source.id});
      definitions.push(...defs);
      log(`source:${source.id}: static definitions=${defs.length}`);
      if (defs.some(d => d.isParameterized)) {
        if (!options.trusted) runtimeDiagnostics.push({ ruleId:'worker/untrusted-workspace', category:'runtime', severity:'warning', projectionImpact:'blocks-part', message:`Vitest materialization blocked for untrusted workspace: ${source.id}` });
        else {
          const materialized = await timedAsync(options,'vitest-materialize',()=>
            materializeVitest(source, defs, options.workspaceRoot, options.vitestWorkerPath, timeout, options.vitestNodeRuntime, log),
            {featureSpaceId:spaceId,sourceId:source.id});
          cases.push(...materialized.cases); runtimeDiagnostics.push(...materialized.diagnostics);
          log(`source:${source.id}: concrete cases=${materialized.cases.length}`);
        }
      }
    }
    if (source.adapter === 'xunit-v3') {
      if (!options.trusted) {
        runtimeDiagnostics.push({
          ruleId:'worker/untrusted-project-analysis', category:'runtime', severity:'warning', projectionImpact:'blocks-part',
          message:`C# project analysis blocked for untrusted workspace: ${source.id}. Trust the workspace and Refresh to enable Roslyn/MSBuild/xUnit evidence.`,
        });
        log(`source:${source.id}: C# project analysis blocked by Workspace Trust`);
        continue;
      }
      if (!fs.existsSync(options.dotnetWorkerDll)) {
        runtimeDiagnostics.push({ ruleId:'worker/dotnet-worker-missing', category:'runtime', severity:'error', projectionImpact:'blocks-part', message:`.NET worker is not available: ${options.dotnetWorkerDll}` });
        log(`source:${source.id}: .NET worker missing: ${options.dotnetWorkerDll}`);
        continue;
      }
      const analyzed = await timedAsync(options,'xunit-static',()=>
        analyzeDotnet(source, spaceId, options.workspaceRoot, options.dotnetWorkerDll, timeout, log),
        {featureSpaceId:spaceId,sourceId:source.id});
      if (!analyzed.ok || !analyzed.value) {
        const prerequisite = classifyDotnetPrerequisiteFailure(analyzed.error, analyzed.stderr, analyzed.stdout);
        runtimeDiagnostics.push(prerequisite ?? { ruleId:'worker/dotnet-analysis-failed', category:'runtime', severity:'error', projectionImpact:'blocks-part', message:workerFailureMessage(analyzed.error, analyzed.stderr, 'C# source analysis failed') });
        continue;
      }
      definitions.push(...analyzed.value.definitions);
      runtimeDiagnostics.push(...(analyzed.value.diagnostics ?? []));
      log(`source:${source.id}: static definitions=${analyzed.value.definitions.length}`);
      if (analyzed.value.definitions.some(d => d.isParameterized)) {
        // Only parameterized xUnit materialization requires a compiled assembly. The whole
        // xUnit project-backed path is already guarded by Workspace Trust above.
        const built = await timedAsync(options,'xunit-build',()=>
          buildDotnetProject(source, options.workspaceRoot, buildTimeout, log),
          {featureSpaceId:spaceId,sourceId:source.id});
        if (!built.ok) {
          const prerequisite = classifyDotnetPrerequisiteFailure(built.error, built.stderr, built.stdout);
          runtimeDiagnostics.push(prerequisite ?? {
            ruleId:'worker/xunit-project-build-failed', category:'runtime', severity:'error', projectionImpact:'blocks-part',
            message:workerFailureMessage(built.error, built.stderr, `xUnit test project build failed for ${source.id}`),
          });
          continue;
        }
        const materialized = await timedAsync(options,'xunit-materialize',()=>
          materializeXunit(source, spaceId, options.workspaceRoot, options.dotnetWorkerDll, timeout, log),
          {featureSpaceId:spaceId,sourceId:source.id});
        if (!materialized.ok || !materialized.value) {
          const prerequisite = classifyDotnetPrerequisiteFailure(materialized.error, materialized.stderr, materialized.stdout);
          runtimeDiagnostics.push(prerequisite ?? { ruleId:'worker/xunit-materialization-failed', category:'runtime', severity:'error', projectionImpact:'blocks-part', message:workerFailureMessage(materialized.error, materialized.stderr, 'xUnit materialization failed') });
        }
        else {
          cases.push(...materialized.value.cases);
          runtimeDiagnostics.push(...(materialized.value.diagnostics ?? []));
          log(`source:${source.id}: concrete cases=${materialized.value.cases.length}`);
        }
      }
    }
  }

  const expanded = timed(options,'expand',()=>expandDefinitions(definitions, cases));
  const diagnostics = [...runtimeDiagnostics, ...expanded.diagnostics];
  const joined = timed(options,'join',()=>joinParts(expanded.parts));
  const rendered = timed(options,'render',()=>renderProjection(joined));
  log(`engine: definitions=${definitions.length} cases=${cases.length} parts=${expanded.parts.length} joined=${joined.length} diagnostics=${diagnostics.length}`);
  return { definitions, cases, parts:expanded.parts, diagnostics, joined, markdown:rendered.markdown, sourceActions:rendered.sourceActions };
}
