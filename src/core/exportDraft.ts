import { NormalizedDiagnostic, NormalizedPart, NormalizedSnapshot, NormalizedSource } from './normalizedSnapshot';

function assertRelativeFile(file:string):void {
  if (typeof file !== 'string' || !file || file.includes('\\') ||
      /^(\/|[A-Za-z]:)/.test(file) || file.includes('\0') ||
      file.split('/').some(part=>!part || part==='.' || part==='..'))
    throw new Error('Disclosure source must use a workspace-relative POSIX path');
}
function copySource(source:NormalizedSource):NormalizedSource {
  if (!source) throw new Error('Disclosure source is missing');
  assertRelativeFile(source.file);
  if (![source.start,source.end,source.line,source.column].every(Number.isSafeInteger) ||
      source.start < 0 || source.end < source.start ||
      source.line < 1 || source.column < 1)
    throw new Error('Disclosure source coordinates are invalid');
  return {file:source.file,start:source.start,end:source.end,
    line:source.line,column:source.column};
}

// Research-only disclosure model. Not a public export schema, command or file writer.
// A draft always requires a separate human privacy review and explicit export consent.
export interface ExperimentalExportDraft {
  kind: 'feature-projection/disclosure-draft';
  publishable: false;
  requiresExplicitConsent: true;
  containsUserAuthoredIdentifiers: true;
  diagnosticMessages: 'omitted';
  assertionSourceCode: 'omitted';
  disclosure: {
    situationCount: number;
    unmatchedPartCount: number;
    unresolvedDefinitionCount: number;
    assertionSnippetCountOmitted: number;
    diagnosticMessageCountOmitted: number;
    blockedEvidencePresent: boolean;
  };
  situations: Array<{
    featureScope: {featureSpaceId:string;logicalFolderKey:string};
    featureName:string;
    outcome:string;
    situation:string;
    frontend: DraftPart|null;
    backend: DraftPart|null;
  }>;
  unresolved: Array<{
    id:string;featureSpaceId:string;logicalFolderKey:string;
    featureName:string|null;outcome:string|null;
    role:'frontend'|'backend';source:NormalizedSource;
    diagnostics:DraftDiagnostic[];
  }>;
  diagnostics:DraftDiagnostic[];
}
export type DraftDiagnostic = Omit<NormalizedDiagnostic,'message'>;
export type DraftPart = Omit<NormalizedPart,'assertions'|'diagnostics'> & {
  assertions: Array<Pick<NormalizedPart['assertions'][number],'kind'|'source'>>;
  diagnostics:DraftDiagnostic[];
};
function redactDiagnostic(d:NormalizedDiagnostic):DraftDiagnostic {
  // Explicitly reconstruct every field; never spread diagnostic message
  // into a potentially shareable JSON object.
  return {ruleId:d.ruleId,category:d.category,severity:d.severity,
    projectionImpact:d.projectionImpact,source:d.source?copySource(d.source):null};
}
function redactPart(part:NormalizedPart|null,
  diagnostics:(input:NormalizedDiagnostic[])=>DraftDiagnostic[]):DraftPart|null {
  if (!part) return null;
  return {
    role:part.role,
    expectedBehavior:part.expectedBehavior,
    trust:part.trust,
    source:copySource(part.source),
    navigationSource:copySource(part.navigationSource),
    assertions:part.assertions.map(a=>({kind:a.kind,source:copySource(a.source)})),
    diagnostics:diagnostics(part.diagnostics),
  };
}
function assertSnapshot(snapshot:NormalizedSnapshot):void {
  if (snapshot?.experimental !== true ||
      !Array.isArray(snapshot.situations) ||
      !Array.isArray(snapshot.unresolved) ||
      !Array.isArray(snapshot.diagnostics))
    throw new Error('Only internally normalized experimental snapshots can be reviewed');
  // The producer is responsible for validating workspace-relative paths,
  // exact identities and source spans. Do not accept arbitrary parsed JSON
  // as a trustworthy normalized workspace snapshot.
}
export function buildExperimentalExportDraft(snapshot:NormalizedSnapshot):ExperimentalExportDraft {
  assertSnapshot(snapshot);
  let assertionSnippetCountOmitted=0;
  let diagnosticMessageCountOmitted=0;
  let unmatchedPartCount=0;
  let blockedEvidencePresent=false;
  const diagnostics=(input:NormalizedDiagnostic[]):DraftDiagnostic[]=>input.map(d=>{
    diagnosticMessageCountOmitted++;
    if(d.projectionImpact==='blocks-part') blockedEvidencePresent=true;
    return redactDiagnostic(d);
  });
  const part=(input:NormalizedPart|null):DraftPart|null=>{
    if (!input) {
      unmatchedPartCount++;
      return null;
    }
    assertionSnippetCountOmitted+=input.assertions.length;
    return redactPart(input,diagnostics);
  };
  const situations=snapshot.situations.map(s=>({
    featureScope:{featureSpaceId:s.featureScope.featureSpaceId,
      logicalFolderKey:s.featureScope.logicalFolderKey},
    featureName:s.featureName,outcome:s.outcome,situation:s.situation,
    frontend:part(s.frontend),backend:part(s.backend),
  }));
  const unresolved=snapshot.unresolved.map(d=>({
    id:d.id,featureSpaceId:d.featureSpaceId,logicalFolderKey:d.logicalFolderKey,
    featureName:d.featureName,outcome:d.outcome,role:d.role,source:copySource(d.source),
    diagnostics:diagnostics(d.diagnostics),
  }));
  const topLevelDiagnostics=diagnostics(snapshot.diagnostics);
  return {
    kind:'feature-projection/disclosure-draft',
    publishable:false,requiresExplicitConsent:true,
    containsUserAuthoredIdentifiers:true,
    diagnosticMessages:'omitted',assertionSourceCode:'omitted',
    disclosure:{
      situationCount:situations.length,unmatchedPartCount,
      unresolvedDefinitionCount:unresolved.length,assertionSnippetCountOmitted,
      diagnosticMessageCountOmitted,blockedEvidencePresent,
    },
    situations,unresolved,diagnostics:topLevelDiagnostics,
  };
}
const permittedJsonKeys=new Set([
  'kind','publishable','requiresExplicitConsent','containsUserAuthoredIdentifiers',
  'diagnosticMessages','assertionSourceCode','disclosure','situationCount',
  'unmatchedPartCount','unresolvedDefinitionCount','assertionSnippetCountOmitted',
  'diagnosticMessageCountOmitted','blockedEvidencePresent','situations','unresolved',
  'diagnostics','featureScope','featureSpaceId','logicalFolderKey','featureName',
  'outcome','situation','frontend','backend','role','expectedBehavior','trust',
  'source','navigationSource','assertions','id','ruleId','category','severity',
  'projectionImpact','file','start','end','line','column',
]);
export function serializeExperimentalExportDraft(draft:ExperimentalExportDraft):string {
  if (draft?.kind !== 'feature-projection/disclosure-draft' ||
      draft.publishable !== false || draft.requiresExplicitConsent !== true ||
      draft.diagnosticMessages !== 'omitted' || draft.assertionSourceCode !== 'omitted')
    throw new Error('Unreviewed or publishable export draft is forbidden');
  // Reject added fields, including a mistakenly reintroduced free-text
  // diagnostic or source-code snippet, even if callers mutate the draft.
  const json=JSON.stringify(draft,function(key,value) {
    if (key && !(Array.isArray(this) && /^\d+$/.test(key)) && !permittedJsonKeys.has(key))
      throw new Error('Experimental disclosure draft contains an unexpected field');
    if (key === 'file') assertRelativeFile(value);
    return value;
  },2);
  return json+'\n';
}
