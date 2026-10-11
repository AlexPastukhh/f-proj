import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const {situationTestId}=require('../dist/core/testingTree.js')
const {planXunitTheoryRun}=require('../dist/core/xunitTheoryRun.js')
const {planXunitBackendRun}=require('../dist/core/xunitBackendRun.js')
const {findExactXunitTheory}=require('../dist/core/xunitFactRunner.js')

function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'fp-p4-theory-unit-'))
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}))
  const project=path.join(root,'service'),file=path.join(project,'Features','Auth.cs')
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'// fixture')
  const source={file,line:15,column:1,start:0,end:1}
  const part={partRole:'backend',featureSpaceId:'app',logicalFolderKey:'Features',
    featureName:'login',outcome:'invalid',situation:'alpha',
    expectedBehavior:'reject',source,diagnostics:[],trust:'trusted'}
  const row={featureSpaceId:'app',logicalFolderKey:'Features',
    featureName:'login',outcome:'invalid',situation:'alpha',backend:part}
  const key='AuthTests.login__invalid__reject(System.String)'
  const ref={adapterId:'xunit-v3',frameworkProject:project,
    frameworkDefinitionKey:key,sourceFile:file,sourceLine:15}
  const definition={adapterId:'xunit-v3',partRole:'backend',isParameterized:true,
    featureSpaceId:'app',logicalFolderKey:'Features',featureName:'login',
    outcome:'invalid',expectedBehavior:'reject',source,diagnostics:[],
    frameworkProject:project,definitionRef:ref}
  const name='AuthTests.login__invalid__reject [alpha]'
  const concrete={definitionRef:{...ref,sourceFile:'',sourceLine:0},
    situationId:'alpha',displayName:name,frameworkCaseId:'1'.repeat(64),
    diagnostics:[]}
  const config={featureSpaces:[{id:'app',sources:[{
    id:'backend',role:'backend',adapter:'xunit-v3',
    frameworkProject:'service',root:'service/Features',projectFile:'Auth.csproj',
  }]}]}
  const input={workspaceRoot:root,config,joined:[row],definitions:[definition],
    cases:[concrete],situationId:situationTestId(row),role:'backend',
    trusted:true,fresh:true,dirtyFilesKnownClean:true}
  return {root,project,file,row,part,definition,concrete,input,name}
}
test('P4 exact xUnit Theory plan and native ID are intentionally distinct',t=>{
  const f=fixture(t),plan=planXunitTheoryRun(f.input)
  assert.equal(plan.displayName,f.name)
  assert.equal(plan.frameworkCaseId,f.concrete.frameworkCaseId)
  assert.equal(plan.fullName,'AuthTests.login__invalid__reject')
  assert.deepEqual(planXunitBackendRun(f.input),plan)
  const assembly=path.join(f.project,'Auth.dll');fs.writeFileSync(assembly,'test')
  const native={Assembly:assembly,DisplayName:f.name,Class:plan.className,
    Method:plan.methodName,ID:'2'.repeat(64)}
  assert.deepEqual(findExactXunitTheory([native],plan,assembly),native)
  assert.notEqual(native.ID,plan.frameworkCaseId)
})
test('P4 Theory refuses stale, unknown, duplicate, disabled or miscorrelated data',t=>{
  const f=fixture(t)
  for(const change of [{trusted:false},{fresh:false},{dirtyFilesKnownClean:false},
    {role:'frontend'},{joined:[f.row,f.row]},{definitions:[]},
    {definitions:[f.definition,f.definition]},{cases:[]},
    {cases:[f.concrete,f.concrete]},{situationId:'absent'},
    {joined:[{...f.row,backend:{...f.part,trust:'degraded'}}]},
    {cases:[{...f.concrete,situationId:'other'}]},
    {cases:[{...f.concrete,displayName:'wrong'}]},
    {cases:[{...f.concrete,frameworkCaseId:'invalid'}]}]){
    assert.throws(()=>planXunitTheoryRun({...f.input,...change}),
      /Run Backend Theory refused/)
  }
})
test('P4 native Theory discovery refuses folded and collision IDs',t=>{
  const f=fixture(t),plan=planXunitTheoryRun(f.input)
  const assembly=path.join(f.project,'Auth.dll');fs.writeFileSync(assembly,'test')
  const native={Assembly:assembly,Class:plan.className,Method:plan.methodName,
    DisplayName:f.name,ID:'2'.repeat(64)}
  const folded={...native,DisplayName:plan.fullName,ID:'3'.repeat(64)}
  assert.equal(findExactXunitTheory([folded],plan,assembly),undefined)
  assert.equal(findExactXunitTheory([native,native],plan,assembly),undefined)
  assert.equal(findExactXunitTheory([native,{...native,ID:'4'.repeat(64)}],
    plan,assembly),undefined)
  assert.equal(findExactXunitTheory([native,{...native,DisplayName:'other',ID:'5'.repeat(64)}],
    plan,assembly)?.ID,native.ID)
  assert.equal(findExactXunitTheory([native,{...native,DisplayName:'other'}],
    plan,path.join(f.project,'other.dll')),undefined)
})
