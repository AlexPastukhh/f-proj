import { Diagnostic } from './types';

export const CANONICAL_ID = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
export const VITEST_SITUATION_MARKER = /\s\[situation:([^\]]+)\]\s*$/;

export interface ParsedDescription {
  featureName?: string;
  outcome?: string;
  situation?: string;
  expectedBehavior?: string;
  diagnostics: Diagnostic[];
}

function canonicalDiagnostic(segment: string, label: string): Diagnostic {
  return {
    ruleId: 'feature-test/canonical-name',
    category: 'projection-safety',
    severity: 'error',
    projectionImpact: 'blocks-part',
    message: `${label} '${segment}' is not canonical snake_case`,
  };
}

export function parseDescription(raw: string, parameterized: boolean): ParsedDescription {
  const diagnostics: Diagnostic[] = [];
  let semantic = raw;
  if (parameterized) semantic = semantic.replace(VITEST_SITUATION_MARKER, '');
  const parts = semantic.split('__');
  const expectedParts = parameterized ? 3 : 4;
  if (parts.length !== expectedParts) {
    diagnostics.push({
      ruleId: 'feature-test/malformed-description',
      category: 'projection-safety',
      severity: 'error',
      projectionImpact: 'blocks-part',
      message: `Expected ${expectedParts} semantic segments, got ${parts.length}: ${semantic}`,
    });
    return { diagnostics };
  }
  const [featureName, outcome, third, fourth] = parts;
  const candidates = parameterized
    ? [['feature', featureName], ['outcome', outcome], ['expectedBehavior', third]] as const
    : [['feature', featureName], ['outcome', outcome], ['situation', third], ['expectedBehavior', fourth]] as const;
  for (const [label, value] of candidates) {
    if (!CANONICAL_ID.test(value!)) diagnostics.push(canonicalDiagnostic(value!, label));
  }
  return parameterized
    ? { featureName, outcome, expectedBehavior: third, diagnostics }
    : { featureName, outcome, situation: third, expectedBehavior: fourth, diagnostics };
}

export function parseSituationId(value: string | undefined): { value?: string; diagnostic?: Diagnostic } {
  if (!value) {
    return {
      diagnostic: {
        ruleId: 'feature-test/missing-situation-id',
        category: 'projection-safety',
        severity: 'error',
        projectionImpact: 'blocks-part',
        message: 'Parameterized concrete case has no explicit Situation identity',
      },
    };
  }
  if (!CANONICAL_ID.test(value)) {
    return {
      diagnostic: {
        ruleId: 'feature-test/invalid-situation-id',
        category: 'projection-safety',
        severity: 'error',
        projectionImpact: 'blocks-part',
        message: `Concrete case Situation '${value}' is not canonical snake_case`,
      },
    };
  }
  return { value };
}
