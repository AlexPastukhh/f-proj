import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const {observeRefreshInputs,compareObservedRefreshInputs}=
  require('../dist/core/refreshInputProbe.js')
function sample(t){
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'fp-input-probe-'))
  t.after(()=>fs.rmSync(workspace,{recursive:true,force:true}))
  const write=(name,body)=>{
    const file=path.join(workspace,name)
    fs.mkdirSync(path.dirname(file),{recursive:true})
    fs.writeFileSync(file,body)
    return file
  }
  write('ui/src/auth.feature.test.ts','test("a",()=>{})')
  write('ui/package.json','{"name":"ui","version":"1"}')
  write('service/Features/Login.cs','class A {}')
  write('service/Tests.csproj','<Project/>')
  write('service/Directory.Build.props','<Project/>')
  const config={workerTimeoutMs:30000,featureSpaces:[
    {id:'a',sources:[{id:'frontend',role:'frontend',adapter:'vitest-5',
      root:'ui/src',frameworkProject:'ui'}]},
    {id:'b',sources:[{id:'backend',role:'backend',adapter:'xunit-v3',
      root:'service/Features',frameworkProject:'service',projectFile:'Tests.csproj'}]},
  ]}
  const probe=(extra={})=>observeRefreshInputs({
    workspaceRoot:workspace,config,trusted:true,dirtyDocumentPaths:[],...extra})
  const diff=(before,after)=>compareObservedRefreshInputs(before,after).differences
  return {workspace,write,config,probe,diff}
}
test('identical known input trees are observed but never authorize cache reuse',(t)=>{
  const {probe,diff}=sample(t),a=probe(),b=probe()
  assert.deepEqual(b,a)
  assert.equal(a.reusePermitted,false)
  assert.deepEqual(a.scopes.map(s=>s.status),['observed','observed'])
  assert.deepEqual(diff(a,b).map(s=>s.state),['observed-unchanged','observed-unchanged'])
  assert.equal(compareObservedRefreshInputs(a,b).reusePermitted,false)
})
test('same-length same-mtime source edits invalidate only their observed source scope',(t)=>{
  const {workspace,probe,diff}=sample(t),a=probe()
  const file=path.join(workspace,'ui/src/auth.feature.test.ts')
  const stamp=fs.statSync(file)
  fs.writeFileSync(file,'test("b",()=>{})')
  fs.utimesSync(file,stamp.atime,stamp.mtime)
  assert.deepEqual(diff(a,probe()).map(s=>s.state),
    ['observed-changed','observed-unchanged'])
})
test('add delete and rename invalidate snapshots, even with unchanged timestamps',(t)=>{
  const {workspace,probe,diff,write}=sample(t),a=probe()
  const file=write('service/Features/Extra.cs','class B {}')
  assert.equal(diff(a,probe())[1].state,'observed-changed')
  fs.renameSync(file,path.join(workspace,'service/Features/Renamed.cs'))
  assert.equal(diff(a,probe())[1].state,'observed-changed')
  fs.unlinkSync(path.join(workspace,'service/Features/Renamed.cs'))
  assert.deepEqual(diff(a,probe()).map(s=>s.state),
    ['observed-unchanged','observed-unchanged'])
})
test('config edits and build metadata conservatively invalidate observed scopes',(t)=>{
  const {probe,config,write,diff}=sample(t),a=probe()
  write('service/Directory.Build.props','<Project><PropertyGroup/></Project>')
  assert.equal(diff(a,probe())[1].state,'observed-changed')
  const original=probe()
  config.workerTimeoutMs=12001
  assert.deepEqual(diff(original,probe()).map(s=>s.state),
    ['observed-changed','observed-changed'])
})
test('unknown editor/trust state refuses claims for all scopes',(t)=>{
  const {probe,diff}=sample(t),a=probe()
  for(const extra of [{dirtyDocumentPaths:undefined},{dirtyDocumentPaths:['unsaved.cs']},
    {trusted:false}]){
    const b=probe(extra)
    assert.ok(b.scopes.every(s=>s.status==='unverifiable'))
    assert.ok(diff(a,b).every(s=>s.state==='unverifiable'))
    assert.equal(b.reusePermitted,false)
  }
})
test('out-of-workspace or missing project paths are unverifiable',(t)=>{
  const {probe,config,diff}=sample(t),a=probe()
  config.featureSpaces[1].sources[0].frameworkProject='../../outside'
  assert.equal(probe().scopes[1].status,'unverifiable')
  assert.equal(diff(a,probe())[1].state,'unverifiable')
  config.featureSpaces[1].sources[0].frameworkProject='missing-project'
  assert.equal(probe().scopes[1].status,'unverifiable')
})
test('excluded package/build output cannot authorize reuse',(t)=>{
  const {probe,write,diff}=sample(t)
  write('ui/node_modules/pkg/index.js','one')
  const a=probe()
  write('ui/node_modules/pkg/index.js','two')
  const b=probe()
  assert.ok(a.scopes[0].ignoredDirectoryCount>0)
  assert.equal(diff(a,b)[0].state,'observed-unchanged')
  assert.equal(compareObservedRefreshInputs(a,b).reusePermitted,false)
})
test('symbolic-link tree or duplicate scope identity is not cache-safe',(t)=>{
  const {workspace,probe,diff}=sample(t),a=probe()
  const external=fs.mkdtempSync(path.join(os.tmpdir(),'fp-external-probe-'))
  t.after(()=>fs.rmSync(external,{recursive:true,force:true}))
  const link=path.join(workspace,'service','linked')
  try {fs.symlinkSync(external,link,'junction')}
  catch {t.skip('junction creation unavailable on this Windows host');return}
  const b=probe()
  assert.equal(b.scopes[1].status,'unverifiable')
  assert.equal(diff(a,b)[1].state,'unverifiable')
  const duplicated={...a,scopes:[...a.scopes,a.scopes[0]]}
  assert.equal(compareObservedRefreshInputs(duplicated,a).differences[0].state,'unverifiable')
})
