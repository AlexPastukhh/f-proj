// D-071: local, read-only Roslyn worker profiling. Never changes Refresh/cache policy.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {performance} from 'node:perf_hooks'
import {fileURLToPath} from 'node:url'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const workspace=path.join(root,'fixtures')
const projectRoot=path.join(workspace,'workspace/backend')
const projectFile=path.join(projectRoot,'Backend.FeatureTests.csproj')
const dll=path.join(root,'workers/dotnet/runtime/FeatureProjection.DotNetWorker.dll')
const rounds=Number(process.argv[2]??2)
if(!Number.isInteger(rounds)||rounds<1||rounds>3) throw Error('rounds must be 1..3')
assert.ok(fs.existsSync(dll),'build/publish .NET worker before profiling')
function sourceDigest(){
  const hash=createHash('sha256')
  const walk=dir=>{
    for(const name of fs.readdirSync(dir).sort()){
      if(['bin','obj','.git','node_modules','.vs'].includes(name)) continue
      const file=path.join(dir,name)
      const info=fs.lstatSync(file)
      if(info.isDirectory()) walk(file)
      else if(info.isFile()){
        hash.update(path.relative(projectRoot,file))
        hash.update(fs.readFileSync(file))
      }
    }
  }
  walk(projectRoot)
  return hash.digest('hex')
}
const initialInputs=sourceDigest()
const source={id:'backend',role:'backend',adapter:'xunit-v3',
  root:path.join(projectRoot,'Features'),frameworkProject:projectRoot,
  projectFile}
const baseRequest={command:'analyze',featureSpaceId:'app',source}
const expectedStages=['msbuild-open','compilation','registrations','features','total']
function worker(profile){
  const started=performance.now()
  const result=spawnSync('dotnet',[dll],{cwd:workspace,
    input:JSON.stringify(profile?{...baseRequest,profile:true}:baseRequest),encoding:'utf8',
    timeout:60000,maxBuffer:20*1024*1024})
  assert.equal(result.error,undefined,'worker spawn failed')
  assert.equal(result.status,0,'worker process exited unsuccessfully: '+result.stderr?.slice(-500))
  const body=JSON.parse(result.stdout)
  assert.ok(Array.isArray(body.definitions)&&Array.isArray(body.diagnostics))
  const records=(result.stderr??'').split(/\r?\n/)
    .filter(line=>line.startsWith('FEATURE_PROJECTION_ROSLYN_PROFILE:'))
  assert.equal(records.length,profile?1:0,'opt-in stderr protocol changed')
  const stages=profile?JSON.parse(records[0].slice('FEATURE_PROJECTION_ROSLYN_PROFILE:'.length)):null
  if(profile){
    assert.equal(stages.schema,1)
    assert.deepEqual(stages.stages.map(row=>row.phase),expectedStages)
    assert.ok(stages.stages.every(row=>Number.isFinite(row.elapsedMs)&&row.elapsedMs>=0))
    assert.ok(!JSON.stringify(stages).includes(projectRoot),'profile must not log paths')
  }
  return {body,stages,wallMs:performance.now()-started}
}
const control=worker(false)
const observations=[]
for(let i=0;i<rounds;i++){
  const measured=worker(true)
  assert.deepEqual(measured.body,control.body,
    'profiling cannot alter Roslyn definitions or diagnostics')
  const phases=Object.fromEntries(measured.stages.stages.map(
    row=>[row.phase,Number(row.elapsedMs.toFixed(1))]))
  observations.push({workerWallMs:Number(measured.wallMs.toFixed(1)),phases})
}
const builds=[]
for(let i=0;i<rounds;i++){
  const started=performance.now()
  const result=spawnSync('dotnet',['build',projectFile,'-c','Release','--nologo'],
    {cwd:projectRoot,encoding:'utf8',timeout:120000,maxBuffer:20*1024*1024})
  assert.equal(result.error,undefined,'build spawn failed')
  assert.equal(result.status,0,'build failed: '+result.stderr?.slice(-500))
  builds.push(Number((performance.now()-started).toFixed(1)))
}
assert.equal(sourceDigest(),initialInputs,'profiling modified fixture source files')
console.log('D071_ROSLYN_PHASE_PROFILE_PASS '+JSON.stringify({
  rounds,definitions:control.body.definitions.length,
  diagnostics:control.body.diagnostics.length,
  workerControlWallMs:Number(control.wallMs.toFixed(1)),
  samples:observations,ordinaryDotnetBuildMs:builds,
  identicalRoslynEvidence:true,profileOptIn:true,
  noCache:true,noUserFileWrites:true,noSourceEdits:true,
}))
