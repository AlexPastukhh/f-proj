import { Diagnostic, FeaturePartScenario, FrameworkConcreteCase, JoinedSituation, PartRole, SourceRange, TestDefinition } from './types';
import { parseSituationId } from './naming';
import { situationTestId } from './testingTree';

function refKey(ref: TestDefinition['definitionRef']): string {
  const project = ref.frameworkProject ?? '';
  const projectKey = process.platform === 'win32' ? project.replace(/\\/g, '/').toLowerCase() : project;
  return `${ref.adapterId}|${projectKey}|${ref.frameworkDefinitionKey}`;
}

function blocked(diags: Diagnostic[]): boolean {
  return diags.some(d => d.projectionImpact === 'blocks-part');
}

export function expandDefinitions(definitions: TestDefinition[], cases: FrameworkConcreteCase[]): { parts: FeaturePartScenario[]; diagnostics: Diagnostic[] } {
  const byRef = new Map<string, FrameworkConcreteCase[]>();
  for (const c of cases) {
    const key = refKey(c.definitionRef);
    const arr = byRef.get(key) ?? [];
    arr.push(c);
    byRef.set(key, arr);
  }

  const parts: FeaturePartScenario[] = [];
  const diagnostics: Diagnostic[] = [];
  for (const d of definitions) {
    diagnostics.push(...d.diagnostics);
    if (!d.featureName || !d.outcome || !d.expectedBehavior || blocked(d.diagnostics)) continue;

    const situations: Array<{ id: string; diagnostics: Diagnostic[]; navigationSource?: SourceRange }> = [];
    if (!d.isParameterized) {
      if (d.directSituation) situations.push({ id: d.directSituation, diagnostics: [] });
    } else {
      const concrete = byRef.get(refKey(d.definitionRef)) ?? [];
      if (concrete.length === 0) {
        diagnostics.push({
          ruleId: 'feature-test/resolvable-situation',
          category: 'projection-safety',
          severity: 'warning',
          projectionImpact: 'blocks-part',
          message: `Parameterized test requires framework materialization: ${d.id}`,
          source: d.source,
        });
        continue;
      }
      for (const c of concrete) {
        diagnostics.push(...c.diagnostics);
        const parsed = parseSituationId(c.situationId);
        if (parsed.diagnostic) {
          diagnostics.push({ ...parsed.diagnostic, source: d.source });
          continue;
        }
        // Concrete Situation is taken ONLY from the framework case. A static anchor may
        // improve navigation, but must never create a case or change its identity.
        const anchors = (d.caseSourceAnchors ?? []).filter(a => a.label === parsed.value);
        situations.push({
          id: parsed.value!,
          diagnostics: c.diagnostics,
          navigationSource: anchors.length === 1 ? anchors[0].source : undefined,
        });
      }
    }

    for (const s of situations) {
      const combined = [...d.diagnostics, ...s.diagnostics];
      if (blocked(combined)) continue;
      parts.push({
        featureSpaceId: d.featureSpaceId,
        logicalFolderKey: d.logicalFolderKey,
        featureName: d.featureName,
        outcome: d.outcome,
        situation: s.id,
        partRole: d.partRole,
        expectedBehavior: d.expectedBehavior,
        assertions: d.assertions,
        source: d.source,
        navigationSource: s.navigationSource,
        diagnostics: combined,
        trust: combined.some(x => x.projectionImpact === 'degrades-part') ? 'degraded' : 'trusted',
      });
    }
  }

  const unique = new Map<string, FeaturePartScenario>();
  const ambiguous = new Set<string>();
  for (const p of parts) {
    const situationKey = `${p.featureSpaceId}|${p.logicalFolderKey}|${p.featureName}|${p.outcome}|${p.partRole}|${p.situation}`;
    if (unique.has(situationKey) || ambiguous.has(situationKey)) {
      unique.delete(situationKey);
      ambiguous.add(situationKey);
      diagnostics.push({
        ruleId: 'feature-test/unique-situation',
        category: 'projection-safety',
        severity: 'error',
        projectionImpact: 'blocks-part',
        message: `Duplicate Situation '${p.situation}' in ${p.partRole} scope ${p.featureSpaceId}/${p.logicalFolderKey}/${p.featureName}/${p.outcome}`,
        source: p.source,
      });
      continue;
    }
    unique.set(situationKey, p);
  }
  return { parts: [...unique.values()], diagnostics };
}

function partOrder(role: PartRole): number { return role === 'frontend' ? 0 : 1; }

export function joinParts(parts: FeaturePartScenario[]): JoinedSituation[] {
  const map = new Map<string, JoinedSituation>();
  for (const p of [...parts].sort((a,b) => partOrder(a.partRole)-partOrder(b.partRole))) {
    const key = `${p.featureSpaceId}|${p.logicalFolderKey}|${p.featureName}|${p.outcome}|${p.situation}`;
    const row = map.get(key) ?? {
      featureSpaceId: p.featureSpaceId,
      logicalFolderKey: p.logicalFolderKey,
      featureName: p.featureName,
      outcome: p.outcome,
      situation: p.situation,
    };
    if (p.partRole === 'frontend') row.frontend = p; else row.backend = p;
    map.set(key, row);
  }
  return [...map.values()].sort((a,b) =>
    [a.featureSpaceId,a.logicalFolderKey,a.featureName,a.outcome,a.situation].join('|')
      .localeCompare([b.featureSpaceId,b.logicalFolderKey,b.featureName,b.outcome,b.situation].join('|'))
  );
}

export interface ProjectionSourceAction {
  line: number;
  label: string;
  role: PartRole;
  source: SourceRange;
}

export interface ProjectionSituationAction {
  line: number;
  testId: string;
}

export interface RenderedProjection {
  markdown: string;
  sourceActions: ProjectionSourceAction[];
  situationActions: ProjectionSituationAction[];
  assertionSourceActions: ProjectionSourceAction[];
}

export interface ProjectionRenderOptions {
  sourceHref?: (source: SourceRange, role: PartRole) => string | undefined;
}

function sourceDisplayName(file: string): string {
  return file.split(/[\\/]/).filter(Boolean).pop() ?? file;
}

function escapeMarkdownLabel(value: string): string {
  return value.replace(/([\\\[\]])/g, '\\$1');
}

function codeFence(sourceCode: string): string {
  let longest = 0;
  for (const match of sourceCode.matchAll(/`+/g)) longest = Math.max(longest, match[0].length);
  return '`'.repeat(Math.max(3, longest + 1));
}

function appendPart(
  lines: string[],
  actions: ProjectionSourceAction[],
  assertionActions: ProjectionSourceAction[],
  label: string,
  part: FeaturePartScenario | undefined,
  options: ProjectionRenderOptions,
): void {
  if (!part) {
    lines.push(`#### ${label}: [unmatched]`, '', '_No matching part._');
    return;
  }

  const partLine = lines.length;
  const navigationSource = part.navigationSource ?? part.source;
  const display = `${label} · ${sourceDisplayName(navigationSource.file)}:${navigationSource.line}`;
  const href = options.sourceHref?.(navigationSource, part.partRole);
  lines.push(href ? `#### [${escapeMarkdownLabel(display)}](${href})` : `#### ${display}`);
  actions.push({ line:partLine, label:`Open ${label} source`, role:part.partRole, source:navigationSource });
  lines.push('', `**Expected behavior:** \`${part.expectedBehavior}\``, '', '**Assertions:**', '');
  if (part.assertions.length === 0) {
    lines.push('_None recognized._');
  } else {
    for (const a of part.assertions) {
      if (a.source?.file) {
        const assertionLine = lines.length;
        const assertionHref = options.sourceHref?.(a.source, part.partRole);
        const assertionLabel = a.kind === 'responsibility' ? 'Open responsibility verification source' : 'Open assertion source';
        if (assertionHref) {
          lines.push(`[${assertionLabel}](${assertionHref})`, '');
        }
        assertionActions.push({line:assertionLine,label:assertionLabel,role:part.partRole,source:a.source});
      }
      const snippet = a.sourceCode.trimEnd();
      const fence = codeFence(snippet);
      lines.push(fence, snippet, fence, '');
    }
    if (lines[lines.length - 1] === '') lines.pop();
  }
  if (part.trust === 'degraded') lines.push('', '**Trust:** degraded');
}

export function renderProjection(joined: JoinedSituation[], options: ProjectionRenderOptions = {}): RenderedProjection {
  const lines = ['# Feature Projection', ''];
  const sourceActions: ProjectionSourceAction[] = [];
  const situationActions: ProjectionSituationAction[] = [];
  const assertionSourceActions: ProjectionSourceAction[] = [];
  let previous = '';
  for (const s of joined) {
    const featureHeader = `${s.featureSpaceId}/${s.logicalFolderKey}/${s.featureName}`;
    if (featureHeader !== previous) {
      if (previous) lines.push('');
      lines.push(`## Feature: ${s.featureName}`, `Scope: ${s.featureSpaceId}/${s.logicalFolderKey}`, '');
      previous = featureHeader;
    }
    lines.push(`### Outcome: ${s.outcome}`);
    situationActions.push({ line:lines.length, testId:situationTestId(s) });
    lines.push(`Situation: ${s.situation}`, '');
    appendPart(lines, sourceActions, assertionSourceActions, 'Frontend', s.frontend, options);
    lines.push('');
    appendPart(lines, sourceActions, assertionSourceActions, 'Backend', s.backend, options);
    lines.push('');
  }
  return { markdown:lines.join('\n'), sourceActions, situationActions, assertionSourceActions };
}

export function renderMarkdown(joined: JoinedSituation[]): string {
  return renderProjection(joined).markdown;
}
