import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const { buildExperimentalSnapshot }=require('../dist/core/normalizedSnapshot.js')
const { buildExperimentalExportDraft,serializeExperimentalExportDraft }=
  require('../dist/core/exportDraft.js')

function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'feature-projection-disclosure-'))
  const file=path.join(root,'access.feature.test.ts')
  fs.writeFileSync(file,'expect(access).toBe(false);\n')
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}))
  const source={file,start:0,end:6,line:1,column:1}
  const diagnostic={ruleId:'project/build-failed',category:'runtime',
    severity:'error',projectionImpact:'blocks-part',
    message:'C:\\Users\\alexa\\secrets\\token.txt not found (Bearer SECRET-123)',
    source}
  const identity={featureSpaceId:'accounts',logicalFolderKey:'access',
    featureName:'request',outcome:'denied',situation:'invalid_token'}
  const part={...identity,partRole:'frontend',source,expectedBehavior:'request_rejected',
    trust:'degraded',diagnostics:[diagnostic],assertions:[
      {kind:'assertion',source,sourceCode:'expect(token).toBe("Bearer SECRET-123")'}
    ]}
  const unresolved={id:'unresolved-case',featureSpaceId:'accounts',
    logicalFolderKey:'access',featureName:'request',outcome:'denied',
    partRole:'backend',isParameterized:true,source,diagnostics:[diagnostic]}
  return {root,source,diagnostic,identity,part,unresolved}
}
test('disclosure draft suppresses diagnostic free text and literal assertions by default',(t)=>{
  const f=fixture(t)
  const normalized=buildExperimentalSnapshot(f.root,
    [{...f.identity,frontend:f.part}],[f.unresolved],[f.diagnostic])
  const draft=buildExperimentalExportDraft(normalized)
  assert.equal(draft.publishable,false)
  assert.equal(draft.requiresExplicitConsent,true)
  assert.equal(draft.diagnosticMessages,'omitted')
  assert.equal(draft.assertionSourceCode,'omitted')
  assert.equal(draft.containsUserAuthoredIdentifiers,true)
  const json=serializeExperimentalExportDraft(draft)
  assert.equal(JSON.parse(json).situations[0].frontend.assertions[0].kind,'assertion')
  assert.equal(JSON.parse(json).situations[0].frontend.assertions[0].source.file,'access.feature.test.ts')
  assert.equal(JSON.parse(json).situations[0].backend,null)
  assert.equal(JSON.parse(json).situations[0].frontend.trust,'degraded')
  assert.equal(draft.disclosure.assertionSnippetCountOmitted,1)
  assert.equal(draft.disclosure.diagnosticMessageCountOmitted,3)
  assert.equal(draft.disclosure.unmatchedPartCount,1)
  assert.equal(draft.disclosure.unresolvedDefinitionCount,1)
  assert.equal(draft.disclosure.blockedEvidencePresent,true)
  assert.equal(json.includes('Bearer SECRET-123'),false)
  assert.equal(json.includes('C:\\Users\\alexa'),false)
  assert.equal(json.includes(f.root),false)
  assert.equal(json.includes('sourceCode'),false)
  assert.equal(json.includes('"message"'),false)
})
test('preview ordering remains repeatable and does not mutate its source',(t)=>{
  const f=fixture(t)
  const norm=buildExperimentalSnapshot(f.root,[{...f.identity,frontend:f.part}],
    [f.unresolved],[f.diagnostic])
  const old=JSON.stringify(norm)
  const a=serializeExperimentalExportDraft(buildExperimentalExportDraft(norm))
  const b=serializeExperimentalExportDraft(buildExperimentalExportDraft(norm))
  assert.equal(a,b)
  assert.equal(JSON.stringify(norm),old)
  assert.ok(a.endsWith('\n'))
})
test('disclosure serializer refuses newly injected content or publishable claims',(t)=>{
  const f=fixture(t)
  const norm=buildExperimentalSnapshot(f.root,[{...f.identity,frontend:f.part}],
    [],[])
  const original=buildExperimentalExportDraft(norm)
  assert.throws(()=>buildExperimentalExportDraft({experimental:false}),/internally normalized/)
  assert.throws(()=>serializeExperimentalExportDraft({
    ...original,publishable:true
  }),/forbidden/)
  assert.throws(()=>serializeExperimentalExportDraft({
    ...original,requiresExplicitConsent:false
  }),/forbidden/)
  assert.throws(()=>serializeExperimentalExportDraft({
    ...original,situations:[{
      ...original.situations[0],frontend:{
        ...original.situations[0].frontend,
        secretToken:'nope'
      }
    }]
  }),/unexpected field/)
  assert.throws(()=>serializeExperimentalExportDraft({
    ...original,diagnostics:[{...original.diagnostics[0],message:'C:/private/secret'}]
  }),/unexpected field/)
})
test('draft locations are cloned and a later mutation cannot change their meaning',(t)=>{
  const f=fixture(t)
  const normalized=buildExperimentalSnapshot(f.root,
    [{...f.identity,frontend:f.part}],[],[])
  const draft=buildExperimentalExportDraft(normalized)
  normalized.situations[0].frontend.source.file='C:/private/secrets.txt'
  assert.equal(draft.situations[0].frontend.source.file,'access.feature.test.ts')
  assert.throws(()=>buildExperimentalExportDraft(normalized),/workspace-relative/)
  draft.situations[0].frontend.source.file='C:/private/secrets.txt'
  assert.throws(()=>serializeExperimentalExportDraft(draft),/workspace-relative/)
})
test('serializer blocks traversal and unexpected nested diagnostic fields',(t)=>{
  const f=fixture(t)
  const normalized=buildExperimentalSnapshot(f.root,
    [{...f.identity,frontend:f.part}],[],[])
  const draft=buildExperimentalExportDraft(normalized)
  draft.situations[0].frontend.assertions[0].source.file='../secrets.txt'
  assert.throws(()=>serializeExperimentalExportDraft(draft),/workspace-relative/)
  draft.situations[0].frontend.assertions[0].source.file='access.feature.test.ts'
  draft.situations[0].frontend.diagnostics[0].message='PRIVATE PATH C:/Users/alexa'
  assert.throws(()=>serializeExperimentalExportDraft(draft),/unexpected field/)
})
