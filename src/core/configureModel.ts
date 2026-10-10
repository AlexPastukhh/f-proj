import { FeatureSourceConfig, PrototypeConfig } from './types';

export interface SourceConfigurationChange {
  featureSpaceId: string;
  source: FeatureSourceConfig;
  replaceSourceId?: string;
}

export function applySourceConfigurationChange(
  config: PrototypeConfig,
  change: SourceConfigurationChange,
): PrototypeConfig {
  const featureSpaces = (config.featureSpaces ?? []).map(space => ({
    ...space,
    sources:[...(space.sources ?? [])],
  }));

  let target = featureSpaces.find(space => space.id === change.featureSpaceId);
  if (!target) {
    target = { id:change.featureSpaceId, sources:[] };
    featureSpaces.push(target);
  }

  if (change.replaceSourceId) {
    target.sources = target.sources.filter(source => source.id !== change.replaceSourceId);
  }
  target.sources.push({ ...change.source });

  return { ...config, featureSpaces };
}

export function isBlockingConfigurationDiagnostic(diagnostic: { projectionImpact:string }): boolean {
  return diagnostic.projectionImpact === 'blocks-part';
}
