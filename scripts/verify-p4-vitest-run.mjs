// P4 first slice: execute one selected Vitest case on the maintained fixture.
import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
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
const {planVitestSituationRun}=require('../dist/core/situationRunPlan.js')
const {runExactVitestSituation}=require('../dist/core/vitestSituationRunner.js')
const file=path.join(workspace,'workspace/frontend/src/features/login/login.feature.test.ts')
const inputHash=()=>createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const before=inputHash()
const workerPath=path.join(root,'workers/vitest-materialize.mjs')
const result=await runFullPrototype({
  workspaceRoot:workspace,config,trusted:true,vitestWorkerPath:workerPath,
  dotnetWorkerDll:path.join(root,'workers/dotnet/runtime/FeatureProjection.DotNetWorker.dll'),
})
assert.equal(result.joined.length,3)
assert.equal(result.diagnostics.filter(d=>d.projectionImpact==='blocks-part').length,0)
const common={workspaceRoot:workspace,config,joined:result.joined,
  definitions:result.definitions,cases:result.cases,role:'frontend',
  trusted:true,fresh:true,dirtyFilesKnownClean:true}
const runtime={command:process.execPath}
let executed=0
for(const row of result.joined.filter(r=>r.frontend)){
  const target=planVitestSituationRun({...common,situationId:situationTestId(row)})
  assert.equal(target.adapter,'vitest-5')
  assert.equal(path.resolve(target.sourceFile),path.resolve(file))
  const selected=await runExactVitestSituation(target,workerPath,30000,runtime)
  assert.equal(selected.status,'passed',JSON.stringify(selected))
  assert.equal(selected.executed,1)
  executed++
}
assert.equal(executed,3,'one direct + two parameterized Vitest cases')
const chosen=result.joined.find(r=>r.frontend)
const situationId=situationTestId(chosen)
for(const overrides of [{fresh:false},{trusted:false},
  {dirtyFilesKnownClean:false},{role:'backend'},
  {situationId:'wrong/situation'}]){
  assert.throws(()=>planVitestSituationRun({
    ...common,situationId,...overrides,
  }),/Run Situation refused/)
}
assert.equal(inputHash(),before,'test run changed authored Feature test')
// Failing user test must be classified as Failed, not worker error.
// All changes live in a disposable OS temp project, not authored fixtures.
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'fp-p4-negative-'))
try {
  const project=path.join(scratch,'ui')
  fs.mkdirSync(project,{recursive:true})
  fs.symlinkSync(path.join(workspace,'workspace/frontend/node_modules'),
    path.join(project,'node_modules'),'junction')
  const broken=path.join(project,'negative.feature.test.ts')
  const title='p4__negative__case__expected_error'
  fs.writeFileSync(broken,
    "import {test,expect} from 'vitest'\n"+
    "test('"+title+"',()=>{expect(1).toBe(2)})\n")
  const failing=await runExactVitestSituation({
    adapter:'vitest-5',featureSpaceId:'test',sourceId:'frontend',
    workspaceRoot:scratch,frameworkProject:project,sourceFile:broken,sourceLine:2,testName:title,
  },workerPath,30000,runtime)
  assert.equal(failing.status,'failed',JSON.stringify(failing))
  assert.equal(failing.executed,1)
} finally { fs.rmSync(scratch,{recursive:true,force:true}) }

console.log('P4_VITEST_EXACT_RUN_PASS selected=3 passed=3 failed_case=1'+
  ' direct=1 parameterized=2 uncached=true trusted_fresh_required=true'+
  ' no_source_edits=true no_release=true')
