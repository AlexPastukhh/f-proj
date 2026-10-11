// D-067 read-only Refresh cost baseline on the maintained real Vitest/xUnit fixture.
// Run after npm run build. Does not enable caching or create a localhost server.
import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {createRequire} from 'node:module'
import {performance} from 'node:perf_hooks'
const require=createRequire(import.meta.url)
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const {readPrototypeConfig}=require('../dist/core/config.js')
const {runFullPrototype}=require('../dist/core/fullEngine.js')
const workspace=path.join(root,'fixtures')
function fixtureInputDigest(){
  const digest=createHash('sha256')
  function scan(dir){
    for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
      if(['node_modules','bin','obj','.git','dist'].includes(entry.name)) continue
      const file=path.join(dir,entry.name)
      if(entry.isDirectory()) scan(file)
      else if(entry.isFile()&&/\.(?:json|cs|csproj|ts|tsx)$/.test(entry.name)){
        digest.update(path.relative(workspace,file));digest.update(fs.readFileSync(file))
      }
    }
  }
  scan(workspace)
  return digest.digest('hex')
}
const originalInputs=fixtureInputDigest()
const config=readPrototypeConfig(path.join(workspace,'feature-projection.config.json'))
const rounds=Number(process.argv[2]??2)
if(!Number.isInteger(rounds)||rounds<1||rounds>5)
  throw Error('Expected a number of sequential rounds between 1 and 5')
const measurements=[]
let firstDocument
for(let round=1;round<=rounds;round++){
  const timings=[]
  const start=performance.now()
  const result=await runFullPrototype({
    workspaceRoot:workspace,config,trusted:true,
    vitestWorkerPath:path.join(root,'workers/vitest-materialize.mjs'),
    dotnetWorkerDll:path.join(root,'workers/dotnet/bin/Release/net8.0/FeatureProjection.DotNetWorker.dll'),
    onTiming:s=>timings.push(s),
  })
  const elapsedMs=performance.now()-start
  assert.equal(result.joined.length,3,'real joined fixture regression')
  assert.equal(result.diagnostics.filter(d=>d.projectionImpact==='blocks-part').length,0)
  const document=JSON.stringify({joined:result.joined,diagnostics:result.diagnostics})
  if(firstDocument!==undefined) assert.equal(document,firstDocument,
    'unchanged fixture must produce identical evidence on successive Refreshes')
  firstDocument=document
  measurements.push({round,elapsedMs:Number(elapsedMs.toFixed(1)),
    phases:timings.map(s=>({phase:s.phase,source:s.sourceId??null,
      elapsedMs:Number(s.elapsedMs.toFixed(1))}))})
}
assert.equal(fixtureInputDigest(),originalInputs,'benchmark changed fixture input files')
const byPhase={}
for(const run of measurements) for(const row of run.phases){
  const key=row.phase+(row.source?'/'+row.source:'')
  ;(byPhase[key]??=[]).push(row.elapsedMs)
}
const summary=Object.fromEntries(Object.entries(byPhase).map(([name,values])=>
  [name,{minMs:Math.min(...values),maxMs:Math.max(...values)}]))
console.log('P3_REFRESH_TIMING_BASELINE_PASS '+JSON.stringify({
  rounds,fixtureSituations:3,blockingDiagnostics:0,
  firstAndRepeatMs:measurements.map(m=>m.elapsedMs),phaseMinMaxMs:summary,
  noCache:true,noSourceEdits:true,standaloneBrowserAcceptance:'PENDING',
}))
