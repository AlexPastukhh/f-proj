import fs = require('node:fs');
import path = require('node:path');
import { Diagnostic, FeatureSourceConfig, PrototypeConfig } from './types';

function runtimeDiagnostic(ruleId: string, message: string, severity: 'error'|'warning' = 'error'): Diagnostic {
  return { ruleId, category:'runtime', severity, projectionImpact:'blocks-part', message };
}

export function validateFeatureSource(
  source: any,
  spaceId: string,
  workspaceRoot: string,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const prefix = `FeatureSpace '${spaceId}' source '${source?.id ?? '<unnamed>'}'`;
  if (!source || typeof source !== 'object') {
    diagnostics.push(runtimeDiagnostic('feature-projection/invalid-source', `${prefix} must be an object`));
    return diagnostics;
  }
  if (!source.id || typeof source.id !== 'string' || !source.id.trim()) diagnostics.push(runtimeDiagnostic('feature-projection/missing-source-id', `${prefix} requires id`));
  if (source.role !== 'frontend' && source.role !== 'backend') diagnostics.push(runtimeDiagnostic('feature-projection/invalid-source-role', `${prefix} has invalid role '${source.role}'`));
  if (source.adapter !== 'vitest-5' && source.adapter !== 'xunit-v3') diagnostics.push(runtimeDiagnostic('feature-projection/invalid-source-adapter', `${prefix} has unsupported adapter '${source.adapter}'`));
  if (!source.root || typeof source.root !== 'string') diagnostics.push(runtimeDiagnostic('feature-projection/missing-source-root', `${prefix} requires root`));
  if (!source.frameworkProject || typeof source.frameworkProject !== 'string') diagnostics.push(runtimeDiagnostic('feature-projection/missing-framework-project', `${prefix} requires frameworkProject`));
  if (source.adapter === 'xunit-v3' && (!source.projectFile || typeof source.projectFile !== 'string')) diagnostics.push(runtimeDiagnostic('feature-projection/missing-project-file', `${prefix} requires projectFile for xUnit`));
  if (source.adapter === 'vitest-5' && source.configFile !== undefined && (typeof source.configFile !== 'string' || !source.configFile.trim())) diagnostics.push(runtimeDiagnostic('feature-projection/invalid-config-file', `${prefix} configFile must be a non-empty string when provided`));
  if (diagnostics.length) return diagnostics;

  const sourceRoot = path.resolve(workspaceRoot, source.root);
  const frameworkRoot = path.resolve(workspaceRoot, source.frameworkProject);
  if (!fs.existsSync(sourceRoot)) diagnostics.push(runtimeDiagnostic('feature-projection/source-root-missing', `${prefix} root does not exist: ${sourceRoot}`));
  if (!fs.existsSync(frameworkRoot)) diagnostics.push(runtimeDiagnostic('feature-projection/framework-project-missing', `${prefix} frameworkProject does not exist: ${frameworkRoot}`));
  if (source.adapter === 'xunit-v3' && source.projectFile) {
    const projectFile = path.resolve(frameworkRoot, source.projectFile);
    if (!fs.existsSync(projectFile)) diagnostics.push(runtimeDiagnostic('feature-projection/project-file-missing', `${prefix} projectFile does not exist: ${projectFile}`));
  }
  if (source.adapter === 'vitest-5' && source.configFile) {
    const configFile = path.resolve(frameworkRoot, source.configFile);
    if (!fs.existsSync(configFile)) diagnostics.push(runtimeDiagnostic('feature-projection/config-file-missing', `${prefix} configFile does not exist: ${configFile}`));
  }
  return diagnostics;
}

export function validatePrototypeConfig(
  config: PrototypeConfig,
  workspaceRoot: string,
): { diagnostics: Diagnostic[]; valid: Array<{spaceId:string; source:FeatureSourceConfig}> } {
  const diagnostics: Diagnostic[] = [];
  const valid: Array<{spaceId:string; source:FeatureSourceConfig}> = [];
  const spaces: any[] = Array.isArray((config as any)?.featureSpaces) ? (config as any).featureSpaces : [];
  if (spaces.length === 0) {
    diagnostics.push(runtimeDiagnostic('feature-projection/no-feature-spaces', 'No Feature Projection featureSpaces are configured. Configure featureProjection.featureSpaces before Refresh.'));
    return { diagnostics, valid };
  }

  const seenSpaces = new Set<string>();
  for (const space of spaces) {
    if (!space?.id || typeof space.id !== 'string' || !space.id.trim()) {
      diagnostics.push(runtimeDiagnostic('feature-projection/missing-feature-space-id', 'Every FeatureSpace requires a non-empty id'));
      continue;
    }
    if (seenSpaces.has(space.id)) diagnostics.push(runtimeDiagnostic('feature-projection/duplicate-feature-space-id', `Duplicate FeatureSpace id '${space.id}'`));
    seenSpaces.add(space.id);
    if (!Array.isArray(space.sources) || space.sources.length === 0) {
      diagnostics.push(runtimeDiagnostic('feature-projection/no-sources', `FeatureSpace '${space.id}' has no sources`));
      continue;
    }
    const seenSourceIds = new Set<string>();
    for (const source of space.sources) {
      if (source?.id && seenSourceIds.has(source.id)) {
        diagnostics.push(runtimeDiagnostic('feature-projection/duplicate-source-id', `FeatureSpace '${space.id}' contains duplicate source id '${source.id}'`));
        continue;
      }
      if (source?.id) seenSourceIds.add(source.id);
      const sourceDiagnostics = validateFeatureSource(source, space.id, workspaceRoot);
      diagnostics.push(...sourceDiagnostics);
      if (!sourceDiagnostics.some(d => d.projectionImpact === 'blocks-part')) valid.push({spaceId:space.id, source});
    }
  }
  return { diagnostics, valid };
}
