import { JoinedSituation } from './types';

// In-memory, JSON-compatible canonical Projection payload.
// Deliberately NOT the redacted D-064 disclosure draft or a public export API.
export interface ProjectionDocument {
  kind: 'feature-projection/internal';
  situations: JoinedSituation[];
}
export function buildProjectionDocument(joined:JoinedSituation[]):ProjectionDocument {
  if (!Array.isArray(joined)) throw new Error('Projection situations are required');
  const seen=new Set<string>();
  for(const row of joined) {
    if (!row || ![row.featureSpaceId,row.logicalFolderKey,row.featureName,
      row.outcome,row.situation].every(x=>typeof x==='string' && x.length>0))
      throw new Error('Incomplete internal Projection identity');
    const identity=JSON.stringify([row.featureSpaceId,row.logicalFolderKey,
      row.featureName,row.outcome,row.situation]);
    if(seen.has(identity)) throw new Error('Duplicate internal Projection Situation');
    seen.add(identity);
  }
  // A detached JSON data model makes both renderers observe identical input
  // even if a later caller modifies worker-owned result objects.
  return {kind:'feature-projection/internal',situations:JSON.parse(JSON.stringify(joined))};
}
