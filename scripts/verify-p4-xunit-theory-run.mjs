// P4.3: real individual xUnit Theory rows, only when native pre-enumeration
// exposes unique runnable IDs. All test source/build outputs live in OS temp.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
const require=createRequire(import.meta.url)
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const {planXunitBackendRun}=require('../dist/core/xunitBackendRun.js')
const {runExactXunitFact,inspectExactXunitCase}=require('../dist/core/xunitFactRunner.js')
const {planRunBoth,executeRunBoth}=require('../dist/core/runBothSituation.js')
const {runExactVitestSituation}=require('../dist/core/vitestSituationRunner.js')
const {situationTestId}=require('../dist/core/testingTree.js')
const worker=path.join(root,'workers/dotnet/runtime/FeatureProjection.DotNetWorker.dll')
const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'fp-p4-theory-exact-'))
const project=path.join(workspace,'service')
const source=path.join(project,'Features','TheoryRows.cs')
const csproj=path.join(project,'TheoryProbe.csproj')
const digestFor=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const digest=()=>digestFor(source)
try {
  fs.mkdirSync(path.dirname(source),{recursive:true})
  fs.writeFileSync(csproj,
    '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup>'+
    '<TargetFramework>net8.0</TargetFramework><OutputType>Exe</OutputType>'+
    '<IsTestProject>true</IsTestProject><IsPackable>false</IsPackable>'+
    '</PropertyGroup><ItemGroup>'+
    '<PackageReference Include="xunit.v3" Version="4.0.1" />'+
    '</ItemGroup></Project>')
  fs.writeFileSync(source,`
using System.Collections.Generic;
using Xunit;
public sealed class P4TheorySamples {
  public static IEnumerable<TheoryDataRow<string>> Cases =>
  [
    new("alpha") { Label = "case_alpha" },
    new("bravo") { Label = "case_bravo" },
    new("fail") { Label = "case_fail" },
  ];
  [Theory][MemberData(nameof(Cases))]
  public void login__invalid__case__expected(string value) {
    if (value == "fail") Assert.True(false);
    else Assert.NotNull(value);
  }
}
`)
  const before=digest()
  const built=spawnSync('dotnet',['build',csproj,'-c','Release','--nologo','-v','quiet'],
    {encoding:'utf8',cwd:project,timeout:120000,maxBuffer:8*1024*1024})
  assert.equal(built.status,0,'temporary project build: '+built.stderr)
  const request={command:'materialize-xunit',featureSpaceId:'app',
    source:{id:'backend',role:'backend',adapter:'xunit-v3',
      frameworkProject:project,root:path.join(project,'Features'),projectFile:csproj}}
  const response=spawnSync('dotnet',[worker],{
    input:JSON.stringify(request),cwd:project,encoding:'utf8',timeout:60000,
    maxBuffer:8*1024*1024})
  assert.equal(response.status,0,'materialization process failed: '+response.stderr)
  const materialized=JSON.parse(response.stdout)
  assert.equal(materialized.diagnostics.length,0)
  assert.equal(materialized.cases.length,3)
  const labels=['case_alpha','case_bravo','case_fail']
  const ui=path.join(workspace,'ui')
  fs.mkdirSync(path.join(ui,'src'),{recursive:true})
  fs.symlinkSync(path.join(root,'fixtures/workspace/frontend/node_modules'),
    path.join(ui,'node_modules'),'junction')
  const uiSource=path.join(ui,'src','login.feature.test.ts')
  fs.writeFileSync(uiSource,"import { test,expect } from 'vitest'\n"+
    labels.map(label=>"test('login__invalid__"+label+
      "__expected',()=>expect(1).toBe(1))").join('\n')+'\n')
  const uiDigest=digestFor(uiSource)
  const vitestWorker=path.join(root,'workers/vitest-materialize.mjs')
  const exampleSource={file:source,line:12,column:3,start:0,end:1}
  const definition={id:'backend',adapterId:'xunit-v3',partRole:'backend',
    frameworkProject:project,isParameterized:true,featureSpaceId:'app',
    logicalFolderKey:'Features',featureName:'login',outcome:'invalid',
    expectedBehavior:'expected',source:exampleSource,diagnostics:[],
    definitionRef:{...materialized.cases[0].definitionRef,sourceFile:source,sourceLine:12}}
  const config={featureSpaces:[{id:'app',sources:[{
    id:'backend',role:'backend',adapter:'xunit-v3',frameworkProject:'service',
    root:'service/Features',projectFile:'TheoryProbe.csproj',
  },{
    id:'frontend',role:'frontend',adapter:'vitest-5',
    frameworkProject:'ui',root:'ui/src',
  }]}]}
  let firstTheoryTarget
  for(const [index,label] of labels.entries()){
    const part={partRole:'backend',featureSpaceId:'app',logicalFolderKey:'Features',
      featureName:'login',outcome:'invalid',situation:label,
      expectedBehavior:'expected',source:exampleSource,diagnostics:[],trust:'trusted'}
    const row={featureSpaceId:'app',logicalFolderKey:'Features',
      featureName:'login',outcome:'invalid',situation:label,backend:part}
    const input={workspaceRoot:workspace,config,joined:[row],
      definitions:[definition],cases:materialized.cases,
      situationId:situationTestId(row),role:'backend',trusted:true,
      fresh:true,dirtyFilesKnownClean:true}
    const selected=planXunitBackendRun(input)
    if(!firstTheoryTarget)firstTheoryTarget=selected
    assert.equal(selected.displayName,
      'P4TheorySamples.login__invalid__case__expected ['+label+']')
    const result=await runExactXunitFact(selected,120000,30000)
    assert.equal(result.status,label==='case_fail'?'failed':'passed',JSON.stringify(result))
    assert.equal(result.executed,1)
    const frontSource={file:uiSource,line:index+2,column:1,start:0,end:1}
    const frontPart={partRole:'frontend',featureSpaceId:'app',
      logicalFolderKey:'Features',featureName:'login',outcome:'invalid',
      situation:label,expectedBehavior:'expected',source:frontSource,
      diagnostics:[],trust:'trusted'}
    const frontDefinition={adapterId:'vitest-5',partRole:'frontend',
      isParameterized:false,frameworkProject:ui,
      featureSpaceId:'app',logicalFolderKey:'Features',
      featureName:'login',outcome:'invalid',directSituation:label,
      expectedBehavior:'expected',source:frontSource,diagnostics:[],
      definitionRef:{adapterId:'vitest-5',frameworkProject:ui,
        frameworkDefinitionKey:'direct:'+label,
        sourceFile:uiSource,sourceLine:index+2}}
    const bothInput={...input,joined:[{...row,frontend:frontPart}],
      definitions:[definition,frontDefinition]}
    const both=planRunBoth(bothInput)
    assert.equal(both.backend.displayName,selected.displayName)
    const called=[]
    const combined=await executeRunBoth(both,{
      valid:()=>true,
      preflightTheory:async target=>{
        called.push('preflight')
        const proof=await inspectExactXunitCase(target,120000,30000)
        assert.equal(proof.ok,true,JSON.stringify(proof))
        assert.notEqual(proof.nativeCaseId,target.frameworkCaseId)
        return proof
      },
      frontend:target=>{
        called.push('frontend')
        return runExactVitestSituation(target,vitestWorker,30000,
          {command:process.execPath})
      },
      backend:(target,proof)=>{
        called.push('backend')
        assert.ok(proof?.nativeCaseId)
        return runExactXunitFact(target,120000,30000,undefined,undefined,proof)
      },
    })
    assert.deepEqual(called,['preflight','frontend','backend'])
    assert.equal(combined.status,label==='case_fail'?'failed':'passed',
      JSON.stringify(combined))
    assert.equal(combined.frontend.executed,1)
    assert.equal(combined.backend.executed,1)
    assert.equal(combined.frontend.status,'passed')
    assert.equal(combined.backend.status,label==='case_fail'?'failed':'passed')
  }
  const actualProof=await inspectExactXunitCase(firstTheoryTarget,120000,30000)
  assert.equal(actualProof.ok,true,JSON.stringify(actualProof))
  const mismatched=await runExactXunitFact(firstTheoryTarget,120000,30000,
    undefined,undefined,{...actualProof,nativeCaseId:'f'.repeat(64)})
  assert.equal(mismatched.status,'error',JSON.stringify(mismatched))
  assert.equal(mismatched.executed,0)
  assert.match(mismatched.message,/changed since Run Both preflight/)
  assert.equal(digest(),before,'temporary authored source changed during test run')
  assert.equal(digestFor(uiSource),uiDigest,'temporary Vitest test source changed')
  console.log('D078_THEORY_RUN_BOTH_PASS rows=3 standalone=3 combined=3'+
    ' combined_preflight_before_frontend=true combined_passed=2 combined_failed=1'+
    ' exact_tests_per_combined_run=2 native_identity_drift_refused=true'+
    ' materializer_ids_not_reused=true no_source_edits=true')
} finally {
  fs.rmSync(workspace,{recursive:true,force:true})
}
