import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const {planXunitFactRun}=require('../dist/core/backendSituationRun.js')
const {planXunitBackendRun}=require('../dist/core/xunitBackendRun.js')
const {findExactXunitFact,validateXunitAutomatedRun}=require('../dist/core/xunitFactRunner.js')
const {situationTestId}=require('../dist/core/testingTree.js')
function data(t){
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'fp-p4-backend-'))
  t.after(()=>fs.rmSync(workspace,{recursive:true,force:true}))
  const project=path.join(workspace,'service')
  const file=path.join(project,'Features','Auth.cs')
  fs.mkdirSync(path.dirname(file),{recursive:true})
  fs.writeFileSync(file,'// test fixture')
  const source={file,line:10,column:1,start:0,end:8}
  const part={partRole:'backend',featureSpaceId:'app',logicalFolderKey:'Features',
    featureName:'login',outcome:'expired',situation:'token_expired',
    expectedBehavior:'rejects_request',source,diagnostics:[],trust:'trusted'}
  const row={featureSpaceId:'app',logicalFolderKey:'Features',
    featureName:'login',outcome:'expired',situation:'token_expired',backend:part}
  const definition={id:'back',adapterId:'xunit-v3',partRole:'backend',
    featureSpaceId:'app',logicalFolderKey:'Features',featureName:'login',
    outcome:'expired',directSituation:'token_expired',
    expectedBehavior:'rejects_request',source,diagnostics:[],
    frameworkProject:project,isParameterized:false,
    definitionRef:{adapterId:'xunit-v3',frameworkProject:project,
      frameworkDefinitionKey:'LoginTests.login__expired__token_expired__rejects_request()',
      sourceFile:file,sourceLine:10}}
  const config={featureSpaces:[{id:'app',sources:[{id:'backend',role:'backend',
    adapter:'xunit-v3',root:'service/Features',frameworkProject:'service',
    projectFile:'Backend.Tests.csproj'}]}]}
  const state={workspaceRoot:workspace,config,joined:[row],definitions:[definition],
    cases:[],situationId:situationTestId(row),role:'backend',
    trusted:true,fresh:true,dirtyFilesKnownClean:true}
  return {workspace,project,file,source,part,row,definition,config,state}
}
test('P4 xUnit Fact planner resolves one exact trusted scope',t=>{
  const f=data(t)
  assert.deepEqual(planXunitBackendRun(f.state),planXunitFactRun(f.state))
  assert.deepEqual(planXunitFactRun(f.state),{
    adapter:'xunit-v3',workspaceRoot:f.workspace,
    featureSpaceId:'app',sourceId:'backend',
    frameworkProject:f.project,projectFile:path.join(f.project,'Backend.Tests.csproj'),
    sourceFile:f.file,className:'LoginTests',
    methodName:'login__expired__token_expired__rejects_request',
    fullName:'LoginTests.login__expired__token_expired__rejects_request',
  })
})
test('P4 xUnit planner refuses parameterized rows, stale, missing, ambiguous and unsafe scopes',t=>{
  const f=data(t)
  for(const change of [{role:'frontend'},{trusted:false},{fresh:false},
    {dirtyFilesKnownClean:false},{joined:[f.row,f.row]},{definitions:[]},
    {definitions:[f.definition,f.definition]},{situationId:'bogus'},
    {definitions:[{...f.definition,isParameterized:true}]},
    {joined:[{...f.row,backend:{...f.part,trust:'degraded'}}]},
    {config:{featureSpaces:[]}},
    {definitions:[{...f.definition,definitionRef:{
      ...f.definition.definitionRef,frameworkDefinitionKey:'LoginTests.method(int)'}}]}]){
    assert.throws(()=>planXunitFactRun({...f.state,...change}),/Run Backend refused/)
  }
})
test('P4 preflight rejects duplicate xUnit names and reused IDs',t=>{
  const f=data(t)
  const target=planXunitFactRun(f.state)
  const assembly=path.join(f.project,'Backend.Tests.dll')
  fs.writeFileSync(assembly,'binary-fixture')
  const entry={Assembly:assembly,DisplayName:target.fullName,
    Class:target.className,Method:target.methodName,ID:'a'.repeat(64)}
  assert.deepEqual(findExactXunitFact([entry],target,assembly),entry)
  assert.equal(findExactXunitFact([entry,{...entry,ID:'b'.repeat(64)}],target,assembly),undefined)
  assert.equal(findExactXunitFact([entry,{...entry,DisplayName:'other',ID:'b'.repeat(64)}],target,assembly)?.ID,entry.ID)
  assert.equal(findExactXunitFact([entry,{...entry,DisplayName:'other',ID:'b'.repeat(64)} ,{...entry,DisplayName:'else',ID:'c'.repeat(64)}],target,assembly)?.ID,entry.ID)
  assert.equal(findExactXunitFact([entry,{...entry,DisplayName:'other'} ,{...entry,DisplayName:'something',ID:entry.ID}],target,assembly),undefined)
  assert.equal(findExactXunitFact([{...entry,Method:'wrong'}],target,assembly),undefined)
  assert.equal(findExactXunitFact([{...entry,ID:'wrong'}],target,assembly),undefined)
})
test('P4 xUnit automated report must prove exactly one correct Fact',()=>{
  const id='f'.repeat(64)
  const line=value=>JSON.stringify(value)
  const assembly={ $type:'test-assembly-finished',TestsTotal:1,
    TestsFailed:0,TestsSkipped:0,TestsNotRun:0}
  const passed={ $type:'test-passed',TestCaseUniqueID:id}
  const report=[line(passed),line(assembly)].join('\n')
  assert.equal(validateXunitAutomatedRun(report,id,0).status,'passed')
  assert.equal(validateXunitAutomatedRun(report,id,1).status,'error')
  assert.equal(validateXunitAutomatedRun(report,'e'.repeat(64),0).status,'error')
  assert.equal(validateXunitAutomatedRun(report+'\n'+line(passed),id,0).status,'error')
  assert.equal(validateXunitAutomatedRun(line({...assembly,TestsTotal:0}),id,0).status,'error')
  assert.equal(validateXunitAutomatedRun('not-json',id,0).status,'error')
  const failedReport=[line({...passed,$type:'test-failed'}),
    line({...assembly,TestsFailed:1})].join('\n')
  assert.deepEqual(validateXunitAutomatedRun(failedReport,id,1),
    {status:'failed',executed:1,message:'Selected xUnit Fact failed'})
  assert.equal(validateXunitAutomatedRun(failedReport,id,0).status,'error')
})
