import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const { readPrototypeConfig }=require('../dist/core/config.js')
const { runFullPrototype }=require('../dist/core/fullEngine.js')
const { buildExperimentalSnapshot,serializeExperimentalSnapshot }=
  require('../dist/core/normalizedSnapshot.js')
const { buildExperimentalExportDraft,serializeExperimentalExportDraft }=
  require('../dist/core/exportDraft.js')
const workspace=path.join(root,'fixtures')
const config=readPrototypeConfig(path.join(workspace,'feature-projection.config.json'))
const result=await runFullPrototype({
  workspaceRoot:workspace,config,trusted:true,
  vitestWorkerPath:path.join(root,'workers/vitest-materialize.mjs'),
  dotnetWorkerDll:path.join(root,'workers/dotnet/bin/Release/net8.0/FeatureProjection.DotNetWorker.dll'),
})
assert.equal(result.joined.length,3,'real Vitest+xUnit fixture must join 3 Situations')
assert.deepEqual(result.diagnostics.filter(d=>d.projectionImpact==='blocks-part'),[],
  'do not certify incomplete source evidence')
const snapshot=buildExperimentalSnapshot(workspace,result.joined,result.definitions,result.diagnostics)
const data=serializeExperimentalSnapshot(snapshot)
const reverse=serializeExperimentalSnapshot(buildExperimentalSnapshot(
  workspace,[...result.joined].reverse(),[...result.definitions].reverse(),
  [...result.diagnostics].reverse()))
assert.equal(data,reverse,'real normalized JSON changes with discovery order')
assert.equal(snapshot.situations.length,3)
assert.equal(snapshot.unresolved.length,0)
assert.ok(snapshot.situations.every(row=>row.frontend && row.backend))
assert.ok(snapshot.situations.every(row=>row.frontend.assertions.length>0 &&
  row.backend.assertions.length>0),'all source assertions must survive')
assert.ok(snapshot.situations.every(row=>row.frontend.source.file.startsWith('workspace/frontend/') &&
  row.backend.source.file.startsWith('workspace/backend/')))
assert.ok(!data.includes(root),'absolute checkout path leaked into internal snapshot')
assert.equal(JSON.parse(data).experimental,true)
const situations=snapshot.situations.map(s=>s.situation)
assert.deepEqual(situations,[
  'email_has_invalid_format','passwords_dont_match','refresh_token_expired'])
const draft=buildExperimentalExportDraft(snapshot)
const draftJson=serializeExperimentalExportDraft(draft)
const draftReverse=serializeExperimentalExportDraft(buildExperimentalExportDraft(
  buildExperimentalSnapshot(workspace,[...result.joined].reverse(),
    [...result.definitions].reverse(),[...result.diagnostics].reverse())))
assert.equal(draftJson,draftReverse,'disclosure JSON varies with discovery order')
assert.equal(draft.publishable,false)
assert.equal(draft.requiresExplicitConsent,true)
assert.equal(draft.assertionSourceCode,'omitted')
assert.equal(draft.diagnosticMessages,'omitted')
assert.equal(draft.disclosure.assertionSnippetCountOmitted,6)
assert.equal(draft.disclosure.situationCount,3)
assert.equal(draft.disclosure.unmatchedPartCount,0)
assert.equal(draft.disclosure.unresolvedDefinitionCount,0)
assert.ok(!draftJson.includes('"sourceCode"'))
assert.ok(!draftJson.includes('"message"'))
assert.ok(!draftJson.includes(root),'absolute checkout leaked in metadata-only draft')
console.log('P1_7_4_METADATA_ONLY_DISCLOSURE_DRAFT_PASS'+
  ' situations=3 omitted_literal_assertions=6 publishable=false'+
  ' consent_required=true no_user_file_writes=true')
console.log('P1_7_4_INTERNAL_NORMALIZED_JSON_FEASIBILITY_PASS'+
  ' situations=3 matched_parts=6 literal_assertions=6'+
  ' paths=workspace-relative no_source_mutation=true public_schema=false')
