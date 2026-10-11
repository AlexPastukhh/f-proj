export type PartRole = 'frontend' | 'backend';
export type ProjectionImpact = 'blocks-part' | 'degrades-part' | 'none';
export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface SourceRange {
  file: string;
  start: number;
  end: number;
  line: number;
  column: number;
}

export interface Diagnostic {
  ruleId: string;
  category: 'projection-safety' | 'test-quality' | 'runtime';
  severity: DiagnosticSeverity;
  projectionImpact: ProjectionImpact;
  message: string;
  source?: SourceRange;
}

export interface AssertionSnippet {
  sourceCode: string;
  source: SourceRange;
  kind: 'assertion' | 'responsibility';
}

export interface TestDefinitionRef {
  adapterId: string;
  frameworkProject?: string;
  frameworkDefinitionKey: string;
  sourceFile: string;
  sourceLine: number;
  frameworkTaskLine?: number;
  frameworkTaskColumn?: number;
}

export interface CaseSourceAnchor {
  // Static source anchor only; concrete Situation always comes from framework-native identity.
  label: string;
  source: SourceRange;
}

export interface TestDefinition {
  id: string;
  featureSpaceId: string;
  logicalFolderKey: string;
  partRole: PartRole;
  adapterId: string;
  frameworkProject: string;
  isParameterized: boolean;
  featureName?: string;
  outcome?: string;
  directSituation?: string;
  expectedBehavior?: string;
  assertions: AssertionSnippet[];
  source: SourceRange;
  definitionRef: TestDefinitionRef;
  caseSourceAnchors?: CaseSourceAnchor[];
  diagnostics: Diagnostic[];
}

export interface FrameworkConcreteCase {
  definitionRef: TestDefinitionRef;
  frameworkCaseId: string;
  situationId?: string;
  displayName?: string;
  diagnostics: Diagnostic[];
}

export interface FeaturePartScenario {
  featureSpaceId: string;
  logicalFolderKey: string;
  featureName: string;
  outcome: string;
  situation: string;
  partRole: PartRole;
  expectedBehavior: string;
  assertions: AssertionSnippet[];
  source: SourceRange;
  navigationSource?: SourceRange;
  diagnostics: Diagnostic[];
  trust: 'trusted' | 'degraded';
}

export interface JoinedSituation {
  featureSpaceId: string;
  logicalFolderKey: string;
  featureName: string;
  outcome: string;
  situation: string;
  frontend?: FeaturePartScenario;
  backend?: FeaturePartScenario;
}

export interface FeatureSourceConfig {
  id: string;
  role: PartRole;
  root: string;
  adapter: 'vitest-5' | 'xunit-v3';
  frameworkProject: string;
  projectFile?: string;
  configFile?: string;
}

export interface FeatureSpaceConfig {
  id: string;
  sources: FeatureSourceConfig[];
}

export interface PrototypeConfig {
  featureSpaces: FeatureSpaceConfig[];
  workerTimeoutMs?: number;
  buildTimeoutMs?: number;
  nodePath?: string;
  portableHtmlDirectory?: string;
}
