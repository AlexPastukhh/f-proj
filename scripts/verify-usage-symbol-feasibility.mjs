import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root=path.resolve(import.meta.dirname,'..')
const worker=path.join(root,'workers','dotnet','bin','Release','net8.0','FeatureProjection.DotNetWorker.dll')
function exec(program,args,input){
  const p=spawnSync(program,args,{cwd:root,input,encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:8*1024*1024})
  if(p.error || p.status!==0) throw new Error(`${program} ${args.join(' ')}: status=${p.status}\n${p.stdout}\n${p.stderr}\n${p.error?.message??''}`)
  return p.stdout
}
if(process.env.FP_USAGE_SKIP_BUILD!=='1'){
  exec('dotnet',['build',path.join(root,'workers','dotnet','FeatureProjection.DotNetWorker.csproj'),'-c','Release','--no-restore','--nologo'])
}
const cases=[
  {folder:'responsibility-proof',project:'Responsibility.FeatureTests.csproj',kind:'responsibility',
   symbol:'User.Authenticate(string)',registration:33,usages:[12,13],excluded:[14,15],
   name:'Authenticate',testFile:path.join('Features','auth','AccessFeatureTests.cs')},
  {folder:'assertion-helper-proof',project:'AssertionHelper.FeatureTests.csproj',kind:'assertion',
   symbol:'FeatureChecks.AssertDenied(bool)',registration:48,usages:[8],excluded:[9,10,11],
   name:'AssertDenied',testFile:path.join('Features','access','AccessFeatureTests.cs')},
]
function probe(fixture,project){
  const data={
    command:'probe-registered-usages',featureSpaceId:'app',
    source:{id:'backend',role:'backend',adapter:'xunit-v3',
      root:path.join(fixture,'Features'),frameworkProject:fixture,
      projectFile:path.join(fixture,project)},
  }
  return JSON.parse(exec('dotnet',[worker],JSON.stringify(data)))
}
for(const expected of cases){
  const folder=path.join(root,'fixtures',expected.folder)
  const data=probe(folder,expected.project)
  assert.equal(data.probeOnly,true)
  assert.equal(data.mutationSupported,false)
  assert.deepEqual(data.diagnostics,[])
  assert.equal(data.targets.length,1,'fake builder or unregistered overload must not yield extra targets')
  const item=data.targets[0]
  assert.equal(item.kind,expected.kind)
  assert.equal(item.symbol,expected.symbol)
  const registration=item.references.filter(r=>r.kind==='registration')
  const feature=item.references.filter(r=>r.kind==='feature-test')
  assert.equal(registration.length,1)
  assert.equal(registration[0].source.line,expected.registration)
  assert.deepEqual(feature.map(r=>r.source.line),expected.usages)
  assert.equal(item.references.length,1+expected.usages.length,'unrelated methods/overloads cannot leak references')
  assert.ok(item.references.every(r=>['registration','feature-test'].includes(r.kind)))
  for(const r of item.references){
    const {file,start,end,line,column}=r.source
    assert.ok(fs.existsSync(file))
    assert.equal(path.resolve(file).toLowerCase().startsWith(folder.toLowerCase()),true)
    const text=fs.readFileSync(file,'utf8')
    assert.equal(text.slice(start,end),expected.name,'Roslyn reference span must identify symbol, not fuzzy name')
    const lines=text.split(/\r?\n/)
    assert.ok(lines[line-1].includes(expected.name))
    assert.ok(column>0)
  }
  const forbidden=expected.excluded
  assert.ok(!feature.some(r=>forbidden.includes(r.source.line)))
  assert.equal(feature.every(r=>path.resolve(r.source.file).toLowerCase()===path.resolve(folder,expected.testFile).toLowerCase()),true)
  console.log(`USAGE_SYMBOL_PASS kind=${expected.kind} refs=${item.references.length} feature_usages=${feature.length} wrong_overloads_excluded=PASS`)
}
// Adversarial duplicate registration: never return a partial reference set.
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'fp-usage-ambiguity-'))
try{
  const source=path.join(root,'fixtures','responsibility-proof')
  fs.cpSync(source,temp,{recursive:true,filter:entry=> !['obj','bin'].includes(path.basename(entry))})
  const config=path.join(temp,'FeatureProjectionConfig.cs')
  const before=fs.readFileSync(config,'utf8')
  const line='builder.RegisterResponsibility<User>(x => x.Authenticate(default(string)!));'
  assert.equal(before.split(line).length,2)
  fs.writeFileSync(config,before.replace(line,line+'\n        '+line),'utf8')
  exec('dotnet',['restore',path.join(temp,'Responsibility.FeatureTests.csproj'),'--nologo'])
  const data=probe(temp,'Responsibility.FeatureTests.csproj')
  assert.equal(data.probeOnly,true)
  assert.equal(data.mutationSupported,false)
  assert.equal(data.targets.length,0,'ambiguous registrations must fail closed')
  assert.equal(data.diagnostics.length,1)
  assert.match(data.diagnostics[0],/Duplicate registration/)
  console.log('USAGE_AMBIGUOUS_REGISTRATION_FAIL_CLOSED_PASS')
} finally {
  fs.rmSync(temp,{recursive:true,force:true,maxRetries:3,retryDelay:250})
}
console.log('P2_8_3_READONLY_SYMBOL_USAGE_FEASIBILITY_PASS projects=2 registered_targets=2 usage_rows=3 rename_mutations=0')
