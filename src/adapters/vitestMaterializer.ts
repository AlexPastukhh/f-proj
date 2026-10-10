import fs = require('node:fs');
import path = require('node:path');
import { Diagnostic, FeatureSourceConfig, FrameworkConcreteCase, TestDefinition } from '../core/types';
import { parseSituationId } from '../core/naming';
import { runJsonWorker } from '../core/process';
import { classifyNodePrerequisiteFailure } from '../core/runtimePrerequisites';

interface RawVitestCase {
  frameworkCaseId: string;
  moduleId: string;
  sourceLine: number;
  sourceColumn: number;
  situationId?: string;
  displayName?: string;
}
interface RawVitestResponse { cases: RawVitestCase[]; diagnostics?: Array<{message:string}> }

function canonicalExistingPath(value: string): string {
  const resolved = path.resolve(value);
  try { return fs.realpathSync.native(resolved); }
  catch { return resolved; }
}

export function frameworkPathKey(value: string, platform: string = process.platform): string {
  const pathApi = platform === 'win32' ? path.win32 : path.posix;
  const resolved = pathApi.resolve(value);
  return platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function sameFrameworkPath(a: string, b: string): boolean {
  return frameworkPathKey(canonicalExistingPath(a)) === frameworkPathKey(canonicalExistingPath(b));
}

export interface NodeWorkerRuntime {
  command: string;
  argsPrefix?: string[];
  env?: Record<string, string | undefined>;
}

export function correlateVitestCases(
  rawCases: RawVitestCase[],
  definitions: TestDefinition[],
): { cases: FrameworkConcreteCase[]; diagnostics: Diagnostic[] } {
  const cases: FrameworkConcreteCase[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const raw of rawCases) {
    const sameLocation = definitions.filter(d =>
      sameFrameworkPath(d.source.file, raw.moduleId) &&
      (d.definitionRef.frameworkTaskLine ?? d.source.line) === raw.sourceLine &&
      (d.definitionRef.frameworkTaskColumn === undefined ||
       d.definitionRef.frameworkTaskColumn === raw.sourceColumn)
    );

    if (sameLocation.length === 1 && !sameLocation[0].isParameterized)
      continue;

    const matches = sameLocation.filter(d => d.isParameterized);
    if (matches.length !== 1) {
      diagnostics.push({
        ruleId:'feature-test/unresolved-test-definition', category:'projection-safety', severity:'error', projectionImpact:'blocks-part',
        message:`Vitest case '${raw.displayName ?? raw.frameworkCaseId}' correlated to ${matches.length} parameterized source TestDefinitions`,
      });
      continue;
    }

    const d = matches[0];
    const parsedSituation = parseSituationId(raw.situationId);
    const caseDiagnostics: Diagnostic[] = [];
    if (parsedSituation.diagnostic)
      caseDiagnostics.push(parsedSituation.diagnostic);

    cases.push({
      definitionRef:d.definitionRef,
      frameworkCaseId:raw.frameworkCaseId,
      situationId:parsedSituation.value,
      displayName:raw.displayName,
      diagnostics:caseDiagnostics,
    });
  }

  return { cases, diagnostics };
}

function failureMessage(
  error: string | undefined,
  stderr: string | undefined,
  stdout: string | undefined,
  fallback: string,
): string {
  const primary = error ?? fallback;
  const stderrDetail = stderr?.trim();
  const stdoutDetail = stdout?.trim();
  const detail = stderrDetail || stdoutDetail;
  if (!detail) return primary;
  const channel = stderrDetail ? 'stderr' : 'stdout';
  const compact = detail.length > 800 ? `${detail.slice(0, 800)}…` : detail;
  return `${primary} (${channel}): ${compact}`;
}

export async function materializeVitest(
  source: FeatureSourceConfig,
  definitions: TestDefinition[],
  workspaceRoot: string,
  workerPath: string,
  timeoutMs: number,
  runtime: NodeWorkerRuntime = { command: process.execPath },
  log?: (message: string) => void,
): Promise<{ cases: FrameworkConcreteCase[]; diagnostics: Diagnostic[] }> {
  const projectRoot = path.resolve(workspaceRoot, source.frameworkProject);
  const filter = path.resolve(workspaceRoot, source.root);
  const configFile = source.configFile ? canonicalExistingPath(path.resolve(projectRoot, source.configFile)) : undefined;
  const result = await runJsonWorker<RawVitestResponse>(runtime.command, [...(runtime.argsPrefix ?? []), workerPath], {
    frameworkProject: projectRoot,
    filters: [filter],
    configFile,
  }, projectRoot, timeoutMs, {
    env: runtime.env,
    label: `vitest:${source.id}`,
    log,
  });

  if (!result.ok || !result.value) {
    const prerequisite = classifyNodePrerequisiteFailure(result.error, result.stderr, result.stdout);
    return { cases:[], diagnostics:[prerequisite ?? {
      ruleId: result.timedOut ? 'worker/materialization-timeout' : 'worker/vitest-materialization-failed',
      category:'runtime', severity:'error', projectionImpact:'blocks-part',
      message: failureMessage(result.error, result.stderr, result.stdout, 'Vitest materialization failed'),
    }] };
  }

  const workerDiagnostics: Diagnostic[] = (result.value.diagnostics ?? []).map(d => ({
    ruleId:'worker/vitest-collection-error', category:'runtime', severity:'error', projectionImpact:'blocks-part', message:d.message,
  }));

  const correlated = correlateVitestCases(result.value.cases, definitions);
  return { cases:correlated.cases, diagnostics:[...workerDiagnostics, ...correlated.diagnostics] };
}
