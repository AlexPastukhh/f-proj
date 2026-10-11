// D-070: local cost study only. No production cache activation or speed threshold.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {performance} from 'node:perf_hooks'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
const require=createRequire(import.meta.url)
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const {analyzeVitestSource,listVitestFeatureFiles}=
  require('../dist/adapters/vitestSource.js')
const {VitestStaticCache}=require('../dist/core/vitestStaticCache.js')
const {readPrototypeConfig}=require('../dist/core/config.js')
const rounds=Number(process.argv[2]??12)
if(!Number.isInteger(rounds)||rounds<4||rounds>30)
  throw Error('rounds must be an integer between 4 and 30')
function digestFiles(dir){
  const hash=createHash('sha256')
  for(const file of listVitestFeatureFiles(dir)){
    hash.update(file);hash.update(fs.readFileSync(file))
  }
  return hash.digest('hex')
}
const median=values=>{
  const sorted=[...values].sort((a,b)=>a-b)
  return sorted.length%2 ? sorted[(sorted.length-1)/2] :
    (sorted[sorted.length/2-1]+sorted[sorted.length/2])/2
}
function measure(label,workspace,source,config){
  const cache=new VitestStaticCache()
  const ctx={config,trusted:true,dirtyDocumentPaths:[]}
  const original=digestFiles(path.resolve(workspace,source.root))
  const cold=cache.analyze(source,'app',workspace,ctx)
  assert.equal(cold.state,'miss')
  const directTimes=[],hitTimes=[]
  for(let i=0;i<rounds;i++){
    let start=performance.now()
    const full=analyzeVitestSource(source,'app',workspace)
    directTimes.push(performance.now()-start)
    start=performance.now()
    const warm=cache.analyze(source,'app',workspace,ctx)
    hitTimes.push(performance.now()-start)
    assert.equal(warm.state,'hit')
    assert.deepEqual(warm.definitions,full)
  }
  assert.equal(digestFiles(path.resolve(workspace,source.root)),original,
    'benchmark modified source inputs')
  const directMs=median(directTimes),cacheHitMs=median(hitTimes)
  return {sample:label,rounds,featureFiles:listVitestFeatureFiles(
      path.resolve(workspace,source.root)).length,
    definitions:cold.definitions.length,
    medianFullStaticMs:Number(directMs.toFixed(3)),
    medianCacheHitMs:Number(cacheHitMs.toFixed(3)),
    ratioFullToHit:Number((directMs/cacheHitMs).toFixed(2)),
    cacheHitFasterInSample:cacheHitMs<directMs}
}
const realWorkspace=path.join(root,'fixtures')
const realConfig=readPrototypeConfig(path.join(realWorkspace,
  'feature-projection.config.json'))
const realSource=realConfig.featureSpaces[0].sources.find(s=>s.adapter==='vitest-5')
assert.ok(realSource)
const real=measure('maintained-fixture',realWorkspace,realSource,realConfig)
const synthetic=fs.mkdtempSync(path.join(os.tmpdir(),'fp-d070-timing-'))
try {
  const dir=path.join(synthetic,'ui','features')
  fs.mkdirSync(dir,{recursive:true})
  const source={id:'front',role:'frontend',adapter:'vitest-5',
    root:'ui/features',frameworkProject:'ui'}
  const config={featureSpaces:[{id:'app',sources:[source]}]}
  for(let i=0;i<120;i++){
    const id=String(i).padStart(4,'0')
    const lines=[]
    for(let j=0;j<3;j++)
      lines.push('test("login__rejected__case_'+        id+'_'+j+'__reject_request",()=>{expect(true).toBe(false)})')
    fs.writeFileSync(path.join(dir,'scenario'+id+'.feature.test.ts'),
      lines.join('\n'))
  }
  const generated=measure('generated-120-files',synthetic,source,config)
  console.log('D070_VITEST_STATIC_CACHE_COST_PASS '+JSON.stringify({
    real,generated,sourceMutations:false,cacheActivation:false,
    runtimeAndRoslynCaching:false,performanceThresholdRequired:false,
  }))
}finally{
  fs.rmSync(synthetic,{recursive:true,force:true})
}
