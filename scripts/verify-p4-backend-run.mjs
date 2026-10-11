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
const {planXunitFactRun}=require('../dist/core/backendSituationRun.js')
const {runExactXunitFact}=require('../dist/core/xunitFactRunner.js')
const source=path.join(workspace,'workspace/backend/Features/login/LoginFeatureTests.cs')
const sha=()=>createHash('sha256').update(fs.readFileSync(source)).digest('hex')
const before=sha()
const result=await runFullPrototype({
  workspaceRoot:workspace,config,trusted:true,
  vitestWorkerPath:path.join(root,'workers/vitest-materialize.mjs'),
  dotnetWorkerDll:path.join(root,'workers/dotnet/runtime/FeatureProjection.DotNetWorker.dll'),
})
assert.equal(result.joined.length,3)
assert.equal(result.diagnostics.filter(d=>d.projectionImpact==='blocks-part').length,0)
const common={workspaceRoot:workspace,config,joined:result.joined,
  definitions:result.definitions,cases:result.cases,
  role:'backend',trusted:true,fresh:true,dirtyFilesKnownClean:true}
let fact=0,theory=0
for(const row of result.joined.filter(row=>row.backend)){
  const args={...common,situationId:situationTestId(row)}
  if(row.situation==='refresh_token_expired'){
    const target=planXunitFactRun(args)
    const run=await runExactXunitFact(target,120000,30000)
    assert.equal(run.status,'passed',JSON.stringify(run))
    assert.equal(run.executed,1)
    fact++
  }else{
    assert.throws(()=>planXunitFactRun(args),/parameterized xUnit Theory row/)
    theory++
  }
}
assert.equal(fact,1)
assert.equal(theory,2)
for(const overrides of [{trusted:false},{fresh:false},{dirtyFilesKnownClean:false},
 {role:'frontend'},{situationId:'wrong'},{definitions:[]}]){
  assert.throws(()=>planXunitFactRun({...common,
    situationId:situationTestId(result.joined.find(r=>r.situation==='refresh_token_expired')),
    ...overrides}),/Run Backend refused/)
}
assert.equal(sha(),before,'Backend source mutated by test runner')
// A real failing Fact is classified Failed, not an infrastructure Error.
// The throwaway project lives only under OS temp; authored fixtures stay unchanged.
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'fp-p4-backend-negative-'))
try{
  const project=path.join(scratch,'service')
  fs.mkdirSync(project,{recursive:true})
  const projectFile=path.join(project,'Backend.FeatureTests.csproj')
  fs.copyFileSync(path.join(workspace,'workspace/backend/Backend.FeatureTests.csproj'),
    projectFile)
  const negativeSource=path.join(project,'P4Negative.cs')
  fs.writeFileSync(negativeSource,
    'using Xunit; public sealed class BackendNegative { [Fact] public void negative_fact() { Assert.True(false); } }\n')
  const failed=await runExactXunitFact({
    adapter:'xunit-v3',workspaceRoot:scratch,featureSpaceId:'test',
    sourceId:'backend',frameworkProject:project,projectFile,
    sourceFile:negativeSource,className:'BackendNegative',
    methodName:'negative_fact',fullName:'BackendNegative.negative_fact',
  },120000,30000)
  assert.equal(failed.status,'failed',JSON.stringify(failed))
  assert.equal(failed.executed,1)
}finally{fs.rmSync(scratch,{recursive:true,force:true})}

console.log('P4_BACKEND_FACT_PASS exact=1 executed=1 failed_fact=1 theory_rows_refused=2'+
  ' guards=trusted_fresh_dirty_scope no_source_edits=true')
