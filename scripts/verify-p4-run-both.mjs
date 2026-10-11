// P4.4 - one complete joined Situation runs Frontend then Backend, exactly.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const workspace=path.join(root,'fixtures')
const config=require('../dist/core/config.js').readPrototypeConfig(
  path.join(workspace,'feature-projection.config.json'))
const {runFullPrototype}=require('../dist/core/fullEngine.js')
const {situationTestId}=require('../dist/core/testingTree.js')
const {planRunBoth,executeRunBoth}=require('../dist/core/runBothSituation.js')
const {runExactVitestSituation}=require('../dist/core/vitestSituationRunner.js')
const {runExactXunitFact,inspectExactXunitCase}=require('../dist/core/xunitFactRunner.js')
const watched=[
  path.join(workspace,'workspace/frontend/src/features/login/login.feature.test.ts'),
  path.join(workspace,'workspace/backend/Features/login/LoginFeatureTests.cs'),
]
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const before=watched.map(hash)
const vitestWorker=path.join(root,'workers/vitest-materialize.mjs')
const state=await runFullPrototype({
  workspaceRoot:workspace,config,trusted:true,vitestWorkerPath:vitestWorker,
  dotnetWorkerDll:path.join(root,'workers/dotnet/runtime/FeatureProjection.DotNetWorker.dll'),
})
assert.equal(state.joined.length,3)
const selected=state.joined.find(row=>row.situation==='refresh_token_expired')
assert.ok(selected?.frontend&&selected?.backend)
const input={workspaceRoot:workspace,config,joined:state.joined,
  definitions:state.definitions,cases:state.cases,
  situationId:situationTestId(selected),
  trusted:true,fresh:true,dirtyFilesKnownClean:true}
const plan=planRunBoth(input)
assert.equal(plan.backend.className,'LoginFeatureTests')
// A folded Theory can be planned statically, but native discovery must
// refuse BEFORE Frontend user tests start (even in Run Both).
let foldedRefused=0
for(const row of state.joined.filter(row=>row.situation!=='refresh_token_expired')){
  const folded=planRunBoth({...input,situationId:situationTestId(row)})
  let frontendCalls=0,backendCalls=0
  const rejected=await executeRunBoth(folded,{
    valid:()=>true,
    preflightTheory:target=>inspectExactXunitCase(target,120000,30000),
    frontend:async()=>{frontendCalls++;throw Error('frontend must not run')},
    backend:async()=>{backendCalls++;throw Error('backend must not run')},
  })
  assert.equal(rejected.status,'error',JSON.stringify(rejected))
  assert.equal(frontendCalls,0)
  assert.equal(backendCalls,0)
  assert.match(rejected.message,/preflight/i)
  foldedRefused++
}
assert.equal(foldedRefused,2)
const calls=[]
const result=await executeRunBoth(plan,{
  valid:()=>true,
  started:stage=>calls.push('start:'+stage),
  finished:(stage,r)=>calls.push('finish:'+stage+':'+r.status+':'+r.executed),
  frontend:target=>runExactVitestSituation(target,vitestWorker,30000,
    {command:process.execPath}),
  backend:target=>runExactXunitFact(target,120000,30000),
})
assert.deepEqual(calls,['start:frontend','finish:frontend:passed:1',
  'start:backend','finish:backend:passed:1'])
assert.equal(result.status,'passed',JSON.stringify(result))
assert.equal(result.frontend.executed,1)
assert.equal(result.backend.executed,1)
assert.deepEqual(watched.map(hash),before,'authored source inputs changed')
console.log('P4_RUN_BOTH_REAL_PASS situations=1 frontend=1 backend=1'+
  ' order=frontend_then_backend exact_tests=2 folded_theory_refused_preflight=true'+
  ' saved_sources_unchanged=true')
