// D-079 Windows proof: a revoked shared P4 lease kills an already-running
// real Vitest test, refuses concurrent runs, and never publishes a PASS.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
const require=createRequire(import.meta.url)
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const {RunSessionGate}=require('../dist/core/runSessionGate.js')
const {runExactVitestSituation}=require('../dist/core/vitestSituationRunner.js')
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function until(fn,ms=22000){
  const start=Date.now()
  while(Date.now()-start<ms){
    if(fn())return true
    await pause(70)
  }
  return false
}
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'fp-p4-run-gate-'))
try{
  const ui=path.join(temp,'ui')
  fs.mkdirSync(ui,{recursive:true})
  fs.symlinkSync(path.join(root,'fixtures/workspace/frontend/node_modules'),
    path.join(ui,'node_modules'),'junction')
  const file=path.join(ui,'session.feature.test.ts')
  const marker=path.join(ui,'running.marker')
  const name='p4__race__session__invalidated'
  fs.writeFileSync(file,
    "import {test} from 'vitest'\n"+
    "import fs from 'node:fs'\n"+
    "test('"+name+"',async()=>{\n"+
    " fs.writeFileSync("+JSON.stringify(marker)+",'running')\n"+
    " await new Promise(r=>setTimeout(r,60000))\n"+
    "})\n")
  const digest=()=>createHash('sha256').update(fs.readFileSync(file)).digest('hex')
  const before=digest()
  const gate=new RunSessionGate()
  const active=gate.acquire()
  assert.ok(active)
  assert.equal(gate.acquire(),undefined,'second P4 request must be refused')
  const run=runExactVitestSituation({
    adapter:'vitest-5',featureSpaceId:'race',sourceId:'frontend',
    workspaceRoot:temp,frameworkProject:ui,sourceFile:file,
    sourceLine:3,testName:name,
  },path.join(root,'workers/vitest-materialize.mjs'),70000,
    {command:process.execPath},undefined,active.signal)
  assert.equal(await until(()=>fs.existsSync(marker)),true,
    'Selected Vitest user test must be executing when session is invalidated')
  gate.invalidate() // Refresh/Stale/file edit uses the same cancellation path.
  assert.equal(active.signal.aborted,true)
  assert.equal(active.isCurrent(),false)
  assert.equal(gate.acquire(),undefined,'revoked run holds lock until it ends')
  const result=await run
  assert.equal(result.status,'error',JSON.stringify(result))
  assert.equal(result.executed,0)
  assert.match(result.message,/cancel/i)
  assert.equal(digest(),before,'authored test input changed')
  active.release()
  const next=gate.acquire()
  assert.ok(next&&!next.signal.aborted)
  next.release()
  console.log('D079_RUN_SESSION_RACE_PASS concurrent_refused=true'+
    ' active_vitest_cancelled=true stale_result_passed=false'+
    ' old_lease_not_reused=true no_source_edits=true')
}finally{
  fs.rmSync(temp,{recursive:true,force:true})
}
