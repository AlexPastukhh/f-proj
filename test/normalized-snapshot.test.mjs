import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const require=createRequire(import.meta.url)
const {buildExperimentalSnapshot,serializeExperimentalSnapshot} =
  require('../dist/core/normalizedSnapshot.js')
function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'feature-projection-json-internal-'))
  const files={}
  for(const file of ['frontend.ts','backend.cs','unresolved.ts']){
    files[file]=path.join(root,file)
    fs.writeFileSync(files[file],file+'\n')
  }
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}))
  const range=(file,line=1)=>({file:files[file],start:0,end:5,line,column:1})
  const diagnostic=(source)=>({
    ruleId:'worker/unresolved',category:'runtime',severity:'warning',
    projectionImpact:'blocks-part',message:'Evidence missing',
    ...(source?{source}:{}),
  })
  const identity={featureSpaceId:'accounts',logicalFolderKey:'auth',
    featureName:'sign_in',outcome:'denied',situation:'bad_password'}
  const part=(role,source)=>({...identity,partRole:role,source,
    expectedBehavior:role==='frontend'?'notice_shown':'login_rejected',
    assertions:[{kind:'assertion',sourceCode:'Assert.True(false);',source}],
    diagnostics:[],trust:'trusted'})
  return {root,files,range,diagnostic,identity,part}
}
test('normalized snapshot preserves exact scope, unmatched role and assertion source',(t)=>{
  const f=fixture(t),back=f.part('backend',f.range('backend.cs'))
  const result=buildExperimentalSnapshot(f.root,[{...f.identity,backend:back}],[],[])
  assert.equal(result.experimental,true)
  assert.equal(result.situations.length,1)
  const row=result.situations[0]
  assert.deepEqual(row.featureScope,{featureSpaceId:'accounts',logicalFolderKey:'auth'})
  assert.equal(row.situation,'bad_password')
  assert.equal(row.frontend,null,'never manufacture unmatched frontend evidence')
  assert.equal(row.backend.expectedBehavior,'login_rejected')
  assert.equal(row.backend.trust,'trusted')
  assert.equal(row.backend.source.file,'backend.cs')
  assert.equal(row.backend.navigationSource.file,'backend.cs')
  assert.equal(row.backend.assertions[0].sourceCode,'Assert.True(false);')
  assert.ok(!serializeExperimentalSnapshot(result).includes(f.root))
  assert.ok(serializeExperimentalSnapshot(result).endsWith('\n'))
})
test('normalization output independent of order of sources and diagnostics',(t)=>{
  const f=fixture(t)
  const left={...f.identity,backend:f.part('backend',f.range('backend.cs'))}
  const right={...f.identity,featureSpaceId:'billing',frontend:{
    ...f.part('frontend',f.range('frontend.ts')),featureSpaceId:'billing'
  }}
  const d1=f.diagnostic(f.range('backend.cs'))
  const d2={...f.diagnostic(),ruleId:'worker/a'}
  const before=JSON.stringify([left,right,d1,d2])
  const a=serializeExperimentalSnapshot(buildExperimentalSnapshot(f.root,[right,left],[],[d1,d2]))
  const b=serializeExperimentalSnapshot(buildExperimentalSnapshot(f.root,[left,right],[],[d2,d1]))
  assert.equal(a,b)
  assert.equal(JSON.stringify([left,right,d1,d2]),before,'normalization must not mutate source inputs')
  assert.deepEqual(JSON.parse(a).situations.map(s=>s.featureScope.featureSpaceId),['accounts','billing'])
  assert.deepEqual(JSON.parse(a).diagnostics.map(d=>d.ruleId),['worker/a','worker/unresolved'])
})
test('degraded trust, navigation anchors and unresolved definitions remain explicit',(t)=>{
  const f=fixture(t)
  const p={...f.part('frontend',f.range('frontend.ts')),trust:'degraded',
    navigationSource:f.range('frontend.ts',2),diagnostics:[f.diagnostic()]}
  const missing={
    id:'static-definition-1',featureSpaceId:'accounts',logicalFolderKey:'auth',
    partRole:'backend',adapterId:'xunit-v3',frameworkProject:f.root,
    isParameterized:true,source:f.range('unresolved.ts'),
    diagnostics:[f.diagnostic(f.range('unresolved.ts'))],
  }
  const result=buildExperimentalSnapshot(f.root,[{...f.identity,frontend:p}],
    [missing], [f.diagnostic()])
  assert.equal(result.situations[0].frontend.trust,'degraded')
  assert.equal(result.situations[0].frontend.navigationSource.line,2)
  assert.equal(result.situations[0].backend,null)
  assert.equal(result.unresolved.length,1)
  assert.equal(result.unresolved[0].role,'backend')
  assert.equal(result.unresolved[0].featureName,null)
  assert.equal(result.unresolved[0].diagnostics[0].source.file,'unresolved.ts')
  assert.equal(result.diagnostics[0].source,null)
})
test('ambiguities and broken exact symbol scope fail closed',(t)=>{
  const f=fixture(t)
  const backend=f.part('backend',f.range('backend.cs'))
  const row={...f.identity,backend}
  assert.throws(()=>buildExperimentalSnapshot(f.root,[row,row],[],[]),/Duplicate/)
  const corrupted={...row,backend:{...backend,partRole:'frontend'}}
  assert.throws(()=>buildExperimentalSnapshot(f.root,[corrupted],[],[]),/Part role/)
  const otherSpace={...row,backend:{...backend,featureSpaceId:'other'}}
  assert.throws(()=>buildExperimentalSnapshot(f.root,[otherSpace],[],[]),/Part identity/)
  assert.throws(()=>serializeExperimentalSnapshot({experimental:false}),/Public or unverified/)
})
test('source traversal and out-of-workspace paths are rejected',(t)=>{
  const f=fixture(t)
  const outside=path.join(os.tmpdir(),'feature-projection-outside-'+process.pid+'.cs')
  fs.writeFileSync(outside,'outside')
  t.after(()=>fs.rmSync(outside,{force:true}))
  const part=f.part('backend',f.range('backend.cs'))
  const row={...f.identity,backend:part}
  assert.throws(()=>buildExperimentalSnapshot(f.root,[{
    ...row,backend:{...part,source:{...part.source,file:outside}}
  }],[],[]),/escapes/)
  assert.throws(()=>buildExperimentalSnapshot(f.root,[{
    ...row,backend:{...part,source:{...part.source,file:'../relative.cs'}}
  }],[],[]),/absolute/)
  assert.throws(()=>buildExperimentalSnapshot(f.root,[{
    ...row,backend:{...part,source:{...part.source,line:0}}
  }],[],[]),/coordinates/)
})
test('unresolved duplicate identities are refused instead of guessed',(t)=>{
  const f=fixture(t)
  const definition={id:'x',featureSpaceId:'app',logicalFolderKey:'auth',
    partRole:'frontend',isParameterized:true,source:f.range('unresolved.ts'),
    diagnostics:[],frameworkProject:f.root,adapterId:'vitest-5'}
  assert.throws(()=>buildExperimentalSnapshot(f.root,[],[definition,definition],[]),
    /Ambiguous unresolved/)
  const first=buildExperimentalSnapshot(f.root,[],[definition],[])
  assert.equal(first.unresolved.length,1)
  assert.deepEqual(first.situations,[])
})
