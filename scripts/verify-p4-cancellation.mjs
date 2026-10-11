// D-077: actual user-test cancellation, not just synthetic worker tests.
// All authored test inputs and reports live in disposable OS temp projects.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const {runExactVitestSituation}=require('../dist/core/vitestSituationRunner.js')
const {runExactXunitFact}=require('../dist/core/xunitFactRunner.js')
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function until(check,timeout=25000){
  const start=Date.now()
  while(Date.now()-start<timeout){if(check())return true;await pause(80)}
  return false
}
const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex')
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'fp-p4-real-cancel-'))
try{
  const ui=path.join(scratch,'ui')
  fs.mkdirSync(ui,{recursive:true})
  fs.symlinkSync(path.join(root,'fixtures/workspace/frontend/node_modules'),
    path.join(ui,'node_modules'),'junction')
  const source=path.join(ui,'slow.feature.test.ts')
  const marker=path.join(ui,'running.marker')
  const testName='p4__cancel__frontend__long'
  fs.writeFileSync(source,
    "import { test } from 'vitest'\n"+
    "import fs from 'node:fs'\n"+
    "test('"+testName+"', async () => {\n"+
    " fs.writeFileSync("+JSON.stringify(marker)+",'started')\n"+
    " await new Promise(resolve => setTimeout(resolve,60000))\n"+
    "})\n")
  const before=hash(source),abort=new AbortController()
  const run=runExactVitestSituation({
    adapter:'vitest-5',featureSpaceId:'p4',sourceId:'frontend',
    workspaceRoot:scratch,frameworkProject:ui,sourceFile:source,
    sourceLine:3,testName,
  },path.join(root,'workers/vitest-materialize.mjs'),75000,
  {command:process.execPath},undefined,abort.signal)
  assert.equal(await until(()=>fs.existsSync(marker)),true,
    'Vitest long test never started, cannot verify mid-execution cancellation')
  abort.abort()
  const result=await run
  assert.equal(result.status,'error',JSON.stringify(result))
  assert.equal(result.executed,0)
  assert.match(result.message,/cancel/i)
  assert.equal(hash(source),before)
  console.log('D077_REAL_VITEST_CANCEL_PASS started=true accepted_as_pass=false')
  const api=path.join(scratch,'api')
  fs.mkdirSync(api,{recursive:true})
  const csproj=path.join(api,'Slow.Tests.csproj')
  const csSource=path.join(api,'SlowCases.cs')
  fs.writeFileSync(csproj,
    '<Project Sdk="Microsoft.NET.Sdk">'+
    '<PropertyGroup><TargetFramework>net8.0</TargetFramework>'+
    '<OutputType>Exe</OutputType><IsTestProject>true</IsTestProject>'+
    '<IsPackable>false</IsPackable></PropertyGroup>'+
    '<ItemGroup><PackageReference Include="xunit.v3" Version="4.0.1" />'+
    '</ItemGroup></Project>')
  fs.writeFileSync(csSource,
    'using System; using System.IO; using System.Threading; using Xunit;\n'+
    'public sealed class SlowCases { [Fact] public void slow_case(){\n'+
    'File.WriteAllText(Path.Combine(AppContext.BaseDirectory,"started.marker"),"started");\n'+
    'Thread.Sleep(60000);\n'+
    '} }\n')
  const oldHash=hash(csSource),abortDotnet=new AbortController()
  const startedFile=path.join(api,'bin','Release','net8.0','started.marker')
  const dotnet=runExactXunitFact({
    adapter:'xunit-v3',workspaceRoot:scratch,featureSpaceId:'p4',
    sourceId:'backend',frameworkProject:api,projectFile:csproj,
    sourceFile:csSource,className:'SlowCases',methodName:'slow_case',
    fullName:'SlowCases.slow_case',
  },120000,75000,undefined,abortDotnet.signal)
  assert.equal(await until(()=>fs.existsSync(startedFile),35000),true,
    'xUnit long Fact never started, cannot verify mid-execution cancellation')
  abortDotnet.abort()
  const backend=await dotnet
  assert.equal(backend.status,'error',JSON.stringify(backend))
  assert.equal(backend.executed,0)
  assert.match(backend.message,/cancel/i)
  assert.equal(hash(csSource),oldHash)
  console.log('D077_REAL_XUNIT_CANCEL_PASS started=true accepted_as_pass=false')
}finally{
  fs.rmSync(scratch,{recursive:true,force:true})
}
