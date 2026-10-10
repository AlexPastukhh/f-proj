import { Diagnostic, FeaturePartScenario, JoinedSituation, PartRole, TestDefinition } from './types';

export type TestingTreeKind = 'feature' | 'outcome' | 'situation' | 'part' | 'unresolved';

export interface TestingTreeNode {
  id: string;
  label: string;
  description?: string;
  kind: TestingTreeKind;
  source?: FeaturePartScenario['source'];
  role?: PartRole;
  trust?: FeaturePartScenario['trust'];
  missing?: boolean;
  error?: string;
  children: TestingTreeNode[];
}

function key(...parts: string[]): string {
  return parts.map(x => encodeURIComponent(x)).join('/');
}

// Share this exact semantic-scope identity with Projection navigation.
// Never locate a Situation by its label alone: labels repeat across FeatureSpaces.
export function situationTestId(row: Pick<JoinedSituation, 'featureSpaceId' | 'logicalFolderKey' | 'featureName' | 'outcome' | 'situation'>): string {
  const featureId = `feature/${key(row.featureSpaceId, row.logicalFolderKey, row.featureName)}`;
  return `${featureId}/outcome/${encodeURIComponent(row.outcome)}/situation/${encodeURIComponent(row.situation)}`;
}

function partNode(parentId: string, roleLabel: string, role: PartRole, part?: FeaturePartScenario): TestingTreeNode {
  if (!part) {
    return {
      id: `${parentId}/${role}`,
      label: roleLabel,
      description: 'unmatched',
      kind: 'part',
      role,
      missing: true,
      children: [],
    };
  }

  return {
    id: `${parentId}/${part.partRole}`,
    label: roleLabel,
    description: part.trust === 'degraded' ? `${part.expectedBehavior} · degraded` : part.expectedBehavior,
    kind: 'part',
    source: part.navigationSource ?? part.source,
    role: part.partRole,
    trust: part.trust,
    children: [],
  };
}

function sameSource(a: {file:string;line:number}, b: {file:string;line:number}): boolean {
  return a.file === b.file && a.line === b.line;
}

function findBlockingDiagnostic(definition: TestDefinition, diagnostics: Diagnostic[]): Diagnostic | undefined {
  return diagnostics.find(d => d.projectionImpact === 'blocks-part' && d.source && sameSource(d.source, definition.source));
}

export function buildTestingTree(
  joined: JoinedSituation[],
  definitions: TestDefinition[] = [],
  diagnostics: Diagnostic[] = [],
): TestingTreeNode[] {
  const features = new Map<string, TestingTreeNode>();
  const outcomes = new Map<string, TestingTreeNode>();

  const ensureFeature = (featureSpaceId: string, logicalFolderKey: string, featureName: string) => {
    const featureId = `feature/${key(featureSpaceId, logicalFolderKey, featureName)}`;
    let feature = features.get(featureId);
    if (!feature) {
      feature = {
        id: featureId,
        label: `${featureName} · ${featureSpaceId}/${logicalFolderKey}`,
        kind: 'feature',
        children: [],
      };
      features.set(featureId, feature);
    }
    return {featureId, feature};
  };

  const ensureOutcome = (featureId: string, feature: TestingTreeNode, outcomeName: string) => {
    const outcomeId = `${featureId}/outcome/${encodeURIComponent(outcomeName)}`;
    let outcome = outcomes.get(outcomeId);
    if (!outcome) {
      outcome = {
        id: outcomeId,
        label: outcomeName,
        kind: 'outcome',
        children: [],
      };
      outcomes.set(outcomeId, outcome);
      feature.children.push(outcome);
    }
    return {outcomeId, outcome};
  };

  for (const row of joined) {
    const {featureId, feature} = ensureFeature(row.featureSpaceId, row.logicalFolderKey, row.featureName);
    const {outcomeId, outcome} = ensureOutcome(featureId, feature, row.outcome);

    const situationId = situationTestId(row);
    const situation: TestingTreeNode = {
      id: situationId,
      label: row.situation,
      kind: 'situation',
      children: [
        partNode(situationId, 'Frontend', 'frontend', row.frontend),
        partNode(situationId, 'Backend', 'backend', row.backend),
      ],
    };
    outcome.children.push(situation);
  }

  // Keep parameterized definitions visible even when framework materialization failed and
  // therefore no concrete Situation could be emitted. This distinguishes "behavior absent"
  // from "behavior exists but concrete cases are unresolved" in Test Explorer.
  const representedDefinitionSources = new Set<string>();
  for (const row of joined) {
    for (const part of [row.frontend, row.backend]) {
      if (part) representedDefinitionSources.add(`${part.partRole}|${part.source.file}|${part.source.line}`);
    }
  }

  const unresolvedGroups = new Map<string, {featureSpaceId:string; logicalFolderKey:string; featureName:string; outcome:string; defs:TestDefinition[]}>();
  for (const d of definitions) {
    if (!d.isParameterized || !d.featureName || !d.outcome || !d.expectedBehavior) continue;
    const represented = representedDefinitionSources.has(`${d.partRole}|${d.source.file}|${d.source.line}`);
    if (represented) continue;
    const groupKey = `${d.featureSpaceId}|${d.logicalFolderKey}|${d.featureName}|${d.outcome}`;
    const group = unresolvedGroups.get(groupKey) ?? {
      featureSpaceId:d.featureSpaceId,
      logicalFolderKey:d.logicalFolderKey,
      featureName:d.featureName,
      outcome:d.outcome,
      defs:[],
    };
    group.defs.push(d);
    unresolvedGroups.set(groupKey, group);
  }

  for (const group of unresolvedGroups.values()) {
    const {featureId, feature} = ensureFeature(group.featureSpaceId, group.logicalFolderKey, group.featureName);
    const {outcomeId, outcome} = ensureOutcome(featureId, feature, group.outcome);
    const unresolvedId = `${outcomeId}/unresolved`;
    const unresolved: TestingTreeNode = {
      id: unresolvedId,
      label: '[situations unresolved]',
      description: 'framework materialization required or failed',
      kind: 'unresolved',
      children: group.defs
        .sort((a,b) => a.partRole === b.partRole ? 0 : a.partRole === 'frontend' ? -1 : 1)
        .map(d => {
          const diag = findBlockingDiagnostic(d, diagnostics);
          return {
            id:`${unresolvedId}/${d.partRole}/${encodeURIComponent(d.id)}`,
            label:d.partRole === 'frontend' ? 'Frontend' : 'Backend',
            description:`${d.expectedBehavior} · unresolved`,
            kind:'part' as const,
            source:d.source,
            role:d.partRole,
            missing:true,
            error:diag?.message,
            children:[],
          };
        }),
    };
    outcome.children.push(unresolved);
  }

  const roots = [...features.values()];
  const sortNodes = (nodes: TestingTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.kind === 'part' && b.kind === 'part') {
        const roleOrder = (x: TestingTreeNode) => x.role === 'frontend' ? 0 : 1;
        return roleOrder(a) - roleOrder(b);
      }
      if (a.kind === 'unresolved' && b.kind !== 'unresolved') return 1;
      if (b.kind === 'unresolved' && a.kind !== 'unresolved') return -1;
      return a.label.localeCompare(b.label);
    });
    for (const node of nodes) sortNodes(node.children);
  };
  sortNodes(roots);
  return roots;
}
