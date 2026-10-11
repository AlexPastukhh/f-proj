import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const {planVitestSituationRun}=require('../dist/core/situationRunPlan.js')
const {situationTestId}=require('../dist/core/testingTree.js')
function fixture(){
  const root=path.resolve(os.tmpdir(),'p4-planning-example')
  const project=path.join(root,'ui')
  const file=path.join(project,'src','login.feature.test.ts')
  const ref={adapterId:'vitest-5',frameworkProject:project,
    frameworkDefinitionKey:'src/login.feature.test.ts:1:1',
    sourceFile:file,sourceLine:1}
  const source={file,line:1,column:1,start:0,end:100}
  const part={featureSpaceId:'app',logicalFolderKey:'.',
    featureName:'login',outcome:'blocked',situation:'expired',
    partRole:'frontend',expectedBehavior:'shows_error',
    assertions:[],source,diagnostics:[],trust:'trusted'}
  const row={featureSpaceId:'app',logicalFolderKey:'.',
    featureName:'login',outcome:'blocked',situation:'expired',frontend:part}
  const def={id:'frontend:1',featureSpaceId:'app',logicalFolderKey:'.',
    partRole:'frontend',adapterId:'vitest-5',frameworkProject:project,
    isParameterized:false,featureName:'login',outcome:'blocked',
    directSituation:'expired',expectedBehavior:'shows_error',
    assertions:[],source,definitionRef:ref,diagnostics:[]}
  const config={featureSpaces:[{id:'app',sources:[{
    id:'frontend',role:'frontend',adapter:'vitest-5',
    frameworkProject:'ui',root:'ui/src',
  }]}]}
  const state={workspaceRoot:root,config,joined:[row],
    definitions:[def],cases:[],
    situationId:situationTestId(row),role:'frontend',
    trusted:true,fresh:true,dirtyFilesKnownClean:true}
  return {state,row,def,part,ref,project,file}
}
test('P4 exact frontend plan derives one scoped direct Situation target',()=>{
  const f=fixture()
  assert.deepEqual(planVitestSituationRun(f.state),{
    adapter:'vitest-5',featureSpaceId:'app',sourceId:'frontend',
    workspaceRoot:f.state.workspaceRoot,frameworkProject:f.project,sourceFile:f.file,sourceLine:1,
    sourceColumn:undefined,configFile:undefined,
    testName:'login__blocked__expired__shows_error',
  })
})
test('P4 refuses stale, untrusted, dirty, backend, absent or ambiguous cases',()=>{
  const f=fixture()
  for(const updates of [{fresh:false},{trusted:false},
    {dirtyFilesKnownClean:false},{role:'backend'},
    {situationId:'wrong'},{joined:[...f.state.joined,f.row]},
    {definitions:[f.def,f.def]},{config:{featureSpaces:[]}}]){
    assert.throws(()=>planVitestSituationRun({...f.state,...updates}),
      /Run Situation refused/)
  }
})
test('P4 requires a trusted matched part and exact source scope',()=>{
  const f=fixture()
  for(const part of [{...f.part,trust:'degraded'},
    {...f.part,diagnostics:[{projectionImpact:'blocks-part'}]},
    undefined]){
    assert.throws(()=>planVitestSituationRun({
      ...f.state,joined:[{...f.row,frontend:part}],
    }),/Run Situation refused/)
  }
  assert.throws(()=>planVitestSituationRun({...f.state,
    definitions:[{...f.def,source:{...f.def.source,line:22}}]}),
    /Run Situation refused/)
  assert.throws(()=>planVitestSituationRun({...f.state,
    config:{featureSpaces:[{id:'app',sources:[{
      id:'frontend',adapter:'vitest-5',role:'frontend',
      frameworkProject:'other',root:'other/src',
    }]}]}}),/Run Situation refused/)
})
test('P4 parameterized target needs exactly one concrete correlated case',()=>{
  const f=fixture()
  const def={...f.def,isParameterized:true,directSituation:undefined}
  const concrete={definitionRef:f.ref,frameworkCaseId:'t1',
    situationId:'expired',displayName:'login__blocked__shows_error [situation:expired]',
    diagnostics:[]}
  const state={...f.state,definitions:[def],cases:[concrete]}
  const target=planVitestSituationRun(state)
  assert.equal(target.testName,concrete.displayName)
  assert.throws(()=>planVitestSituationRun({...state,cases:[]}),
    /Run Situation refused/)
  assert.throws(()=>planVitestSituationRun({...state,
    cases:[concrete,concrete]}),/Run Situation refused/)
  assert.throws(()=>planVitestSituationRun({...state,
    cases:[{...concrete,definitionRef:{...f.ref,sourceLine:44}}]}),
    /Run Situation refused/)
})

test('P4 fresh collection refuses duplicate names even at different source lines',()=>{
  const f=fixture()
  const {hasUniqueCollectedVitestTarget}=require('../dist/core/vitestSituationRunner.js')
  const target={...planVitestSituationRun(f.state),sourceFile:path.resolve(
    'fixtures/workspace/frontend/src/features/login/login.feature.test.ts')}
  const collected={moduleId:target.sourceFile,sourceLine:1,sourceColumn:1,
    displayName:target.testName,frameworkCaseId:'a'}
  assert.equal(hasUniqueCollectedVitestTarget([collected],target),true)
  assert.equal(hasUniqueCollectedVitestTarget([],target),false)
  assert.equal(hasUniqueCollectedVitestTarget(
    [collected,{...collected,sourceLine:99,frameworkCaseId:'b'}],target),false)
  assert.equal(hasUniqueCollectedVitestTarget(
    [{...collected,sourceLine:99}],target),false)
  assert.equal(hasUniqueCollectedVitestTarget(
    [{...collected,moduleId:f.file+'-other'}],target),false)
  assert.equal(hasUniqueCollectedVitestTarget(
    [{...collected,displayName:target.testName+'suffix'}],target),false)
})

test('P4 runner refuses a physically out-of-workspace project before any worker',async()=>{
  const {runExactVitestSituation}=require('../dist/core/vitestSituationRunner.js')
  const target={
    adapter:'vitest-5',featureSpaceId:'app',sourceId:'frontend',
    workspaceRoot:path.resolve(os.tmpdir()),
    frameworkProject:path.resolve('fixtures/workspace/frontend'),
    sourceFile:path.resolve(
      'fixtures/workspace/frontend/src/features/login/login.feature.test.ts'),
    sourceLine:19,
    testName:'login__session_expired__refresh_token_expired__reauthentication_screen_is_shown',
  }
  const result=await runExactVitestSituation(target,'unavailable-worker',10000,
    {command:process.execPath})
  assert.equal(result.status,'error')
  assert.match(result.message,/escapes trusted workspace/)
  assert.equal(result.executed,0)
})
