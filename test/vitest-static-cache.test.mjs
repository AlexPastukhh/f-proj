import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const {VitestStaticCache}=require('../dist/core/vitestStaticCache.js')
const {analyzeVitestSource}=require('../dist/adapters/vitestSource.js')
function setup(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'fp-d069-static-'))
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}))
  const dir=path.join(root,'ui','src','features')
  fs.mkdirSync(dir,{recursive:true})
  const one=path.join(dir,'auth.feature.test.ts')
  const write=(file,content)=>{
    fs.mkdirSync(path.dirname(file),{recursive:true})
    fs.writeFileSync(file,content,'utf8')
  }
  const literal=(situation='expired')=>
    'test("login__rejects__'+situation+'__rejects_request",()=>{expect(true).toBe(false)})'
  write(one,literal())
  const source={id:'front',role:'frontend',adapter:'vitest-5',
    root:'ui/src/features',frameworkProject:'ui'}
  const config={featureSpaces:[{id:'account',sources:[source]}]}
  const opts=(overrides={})=>({...{
    config,trusted:true,dirtyDocumentPaths:[]},...overrides})
  const cache=new VitestStaticCache()
  const run=(scope='account',overrides={})=>
    cache.analyze(source,scope,root,opts(overrides))
  return {root,one,write,literal,source,config,opts,cache,run}
}
test('cold miss then hit agrees with uncached analyzer and returns detached definitions',(t)=>{
  const x=setup(t),cold=x.run()
  assert.equal(cold.state,'miss')
  assert.deepEqual(cold.definitions,analyzeVitestSource(x.source,'account',x.root))
  assert.equal(cold.definitions.length,1)
  cold.definitions[0].featureName='mutated outside cache'
  const warm=x.run()
  assert.equal(warm.state,'hit')
  assert.deepEqual(warm.definitions,analyzeVitestSource(x.source,'account',x.root))
  warm.definitions[0].assertions[0].sourceCode='mutated again'
  assert.deepEqual(x.run().definitions,analyzeVitestSource(x.source,'account',x.root))
  assert.equal(x.cache.size,1)
  x.cache.clear()
  assert.equal(x.run().state,'miss')
})
test('byte-level change despite identical length and preserved mtime invalidates',(t)=>{
  const x=setup(t)
  assert.equal(x.run().state,'miss')
  const before=fs.statSync(x.one)
  const text=fs.readFileSync(x.one,'utf8').replace('expired','expires')
  assert.equal(Buffer.byteLength(text),before.size)
  x.write(x.one,text)
  fs.utimesSync(x.one,before.atime,before.mtime)
  const updated=x.run()
  assert.equal(updated.state,'miss')
  assert.match(updated.definitions[0].directSituation,/expires/)
  assert.equal(x.run().state,'hit')
})
test('addition, rename and deletion all change the snapshot',(t)=>{
  const x=setup(t),another=path.join(path.dirname(x.one),'next.feature.spec.ts')
  assert.equal(x.run().state,'miss')
  x.write(another,x.literal('second'))
  assert.equal(x.run().state,'miss')
  assert.equal(x.run().definitions.length,2)
  fs.renameSync(another,path.join(path.dirname(x.one),'renamed.feature.spec.ts'))
  assert.equal(x.run().state,'miss')
  fs.rmSync(path.join(path.dirname(x.one),'renamed.feature.spec.ts'))
  assert.equal(x.run().state,'miss')
  assert.equal(x.run().definitions.length,1)
})
test('FeatureSpace, scope role and config identity cannot cross-hit',(t)=>{
  const x=setup(t)
  assert.equal(x.run().state,'miss')
  assert.equal(x.run('other').state,'miss')
  assert.equal(x.run('other').definitions[0].featureSpaceId,'other')
  x.config.workerTimeoutMs=20001
  assert.equal(x.run().state,'miss')
  x.source.role='backend'
  assert.equal(x.run().state,'miss')
  assert.equal(x.run().definitions[0].partRole,'backend')
})
test('unknown/dirty/untrusted editor state always forces non-cached analysis',(t)=>{
  const x=setup(t)
  assert.equal(x.run().state,'miss')
  for(const overrides of [{dirtyDocumentPaths:undefined},
    {dirtyDocumentPaths:[x.one]},{trusted:false}]){
    assert.equal(x.run('account',overrides).state,'bypass')
    assert.deepEqual(x.run('account',overrides).definitions,
      analyzeVitestSource(x.source,'account',x.root))
  }
  assert.equal(x.run().state,'hit')
})
test('outside workspace configuration cannot get a cached hit',(t)=>{
  const x=setup(t)
  const original=x.source.frameworkProject
  assert.equal(x.run().state,'miss')
  x.source.frameworkProject='../../external'
  assert.equal(x.run().state,'bypass')
  x.source.frameworkProject=original
  assert.equal(x.run().state,'hit')
})
test('a junction source root forces bypass instead of cached result',(t)=>{
  const x=setup(t)
  assert.equal(x.run().state,'miss')
  const junction=path.join(x.root,'feature-alias')
  fs.symlinkSync(path.dirname(x.one),junction,'junction')
  x.source.root='feature-alias'
  assert.equal(x.run().state,'bypass')
})
test('bounded LRU storage evicts inactive source identities',(t)=>{
  const x=setup(t),cache=new VitestStaticCache(1)
  const run=scope=>cache.analyze(x.source,scope,x.root,x.opts())
  assert.equal(run('first').state,'miss')
  assert.equal(run('second').state,'miss')
  assert.equal(cache.size,1)
  assert.equal(run('first').state,'miss')
  assert.throws(()=>new VitestStaticCache(0),/1\.\.128/)
})

test('aliased workspace root is safe when scoped paths are not junctions',(t)=>{
  const x=setup(t)
  const holder=fs.mkdtempSync(path.join(os.tmpdir(),'fp-d069-alias-'))
  t.after(()=>fs.rmSync(holder,{recursive:true,force:true}))
  const alias=path.join(holder,'workspace')
  fs.symlinkSync(x.root,alias,'junction')
  const first=x.cache.analyze(x.source,'account',alias,x.opts())
  const second=x.cache.analyze(x.source,'account',alias,x.opts())
  assert.equal(first.state,'miss')
  assert.equal(second.state,'hit')
  assert.deepEqual(second.definitions,analyzeVitestSource(x.source,'account',alias))
})

function injectAfterFirstFileRead(target,mutation,invoke){
  const original=fs.readFileSync
  let triggered=false
  fs.readFileSync=function(file,...args){
    const bytes=original.call(this,file,...args)
    if(!triggered && typeof file==='string' &&
      path.resolve(file)===path.resolve(target)){
      triggered=true
      mutation()
    }
    return bytes
  }
  try {
    const result=invoke()
    assert.equal(triggered,true,'the test must exercise a real capture read')
    return result
  } finally {
    fs.readFileSync=original
  }
}
test('file edited during cold capture is reparsed uncached, not stored',(t)=>{
  const x=setup(t)
  const result=injectAfterFirstFileRead(x.one,
    ()=>x.write(x.one,x.literal('changed')),()=>x.run())
  assert.equal(result.state,'bypass')
  assert.deepEqual(result.definitions,analyzeVitestSource(x.source,'account',x.root))
  assert.equal(result.definitions[0].directSituation,'changed')
  assert.equal(x.cache.size,0)
  assert.equal(x.run().state,'miss')
})

test('warm hit refuses file edit between input observations',(t)=>{
  const x=setup(t)
  assert.equal(x.run().state,'miss')
  const result=injectAfterFirstFileRead(x.one,
    ()=>x.write(x.one,x.literal('changed')),()=>x.run())
  assert.equal(result.state,'bypass')
  assert.deepEqual(result.definitions,analyzeVitestSource(x.source,'account',x.root))
  assert.equal(result.definitions[0].directSituation,'changed')
  assert.equal(x.run().state,'miss')
})
test('new feature file arriving during cold capture is not cached',(t)=>{
  const x=setup(t)
  const added=path.join(path.dirname(x.one),'later.feature.test.ts')
  const result=injectAfterFirstFileRead(x.one,
    ()=>x.write(added,x.literal('added')),()=>x.run())
  assert.equal(result.state,'bypass')
  assert.equal(result.definitions.length,2)
  assert.deepEqual(result.definitions,analyzeVitestSource(x.source,'account',x.root))
  assert.equal(x.cache.size,0)
})

test('dirty editor appearing mid-capture prevents cold cache entry',(t)=>{
  const x=setup(t)
  const dirty=[]
  const context=x.opts({dirtyDocumentPaths:dirty})
  const result=injectAfterFirstFileRead(x.one,()=>dirty.push(x.one),
    ()=>x.cache.analyze(x.source,'account',x.root,context))
  assert.equal(result.state,'bypass')
  assert.deepEqual(result.definitions,analyzeVitestSource(x.source,'account',x.root))
  assert.equal(x.cache.size,0)
})
test('dirty editor appearing during warm hit forces authoritative bypass',(t)=>{
  const x=setup(t)
  assert.equal(x.run().state,'miss')
  const dirty=[]
  const context=x.opts({dirtyDocumentPaths:dirty})
  const result=injectAfterFirstFileRead(x.one,()=>dirty.push(x.one),
    ()=>x.cache.analyze(x.source,'account',x.root,context))
  assert.equal(result.state,'bypass')
  assert.deepEqual(result.definitions,analyzeVitestSource(x.source,'account',x.root))
})
