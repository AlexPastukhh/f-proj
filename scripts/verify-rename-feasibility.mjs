import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const worker = path.join(root, 'workers/dotnet/bin/Release/net8.0/FeatureProjection.DotNetWorker.dll')
function execute(command, args, input) {
  const run = spawnSync(command, args, {cwd:root, input, encoding:'utf8',
    windowsHide:true, timeout:120000, maxBuffer:8*1024*1024})
  if (run.status !== 0 || run.error)
    throw new Error(`${command} ${args.join(' ')} failed: ${run.stdout} ${run.stderr} ${run.error?.message??''}`)
  return run.stdout
}
if (process.env.FP_RENAME_SKIP_BUILD !== '1')
  execute('dotnet', ['build', 'workers/dotnet/FeatureProjection.DotNetWorker.csproj',
    '-c', 'Release', '--no-restore', '--nologo'])

function probe(folder, project, symbol, newName) {
  const req = {command:'probe-registered-rename', featureSpaceId:'app',
    symbol, newName, source:{id:'backend',role:'backend',adapter:'xunit-v3',
    root:path.join(folder,'Features'), frameworkProject:folder,
    projectFile:path.join(folder,project)}}
  return JSON.parse(execute('dotnet',[worker],JSON.stringify(req)))
}
function snapshot(dir) {
  const result = {}
  function visit(here) {
    for(const ent of fs.readdirSync(here,{withFileTypes:true})) {
      if(ent.isDirectory()) {
        if(!['bin','obj','node_modules'].includes(ent.name)) visit(path.join(here,ent.name))
      } else if(ent.isFile() && /\.(cs|csproj)$/.test(ent.name)){
        const file=path.join(here,ent.name)
        result[path.relative(dir,file)] = createHash('sha256').update(fs.readFileSync(file)).digest('hex')
      }
    }
  }
  visit(dir)
  return result
}
const cases = [
  {fixture:'responsibility-proof', project:'Responsibility.FeatureTests.csproj',
    symbol:'User.Authenticate(string)', name:'Authenticate',
    newName:'AuthenticateCredentials', lines:[20,33,12,13],
    excluded:[14], count:4},
  {fixture:'assertion-helper-proof', project:'AssertionHelper.FeatureTests.csproj',
    symbol:'FeatureChecks.AssertDenied(bool)', name:'AssertDenied',
    newName:'AssertAccessDenied', lines:[20,48,8],
    excluded:[9,10], count:3},
]
for(const c of cases) {
  const dir=path.join(root,'fixtures',c.fixture)
  const before=snapshot(dir)
  const result=probe(dir,c.project,c.symbol,c.newName)
  assert.equal(result.probeOnly,true)
  assert.equal(result.mutationSupported,false)
  assert.equal(result.projectScopeOnly,true)
  assert.equal(result.accepted,true,JSON.stringify(result.diagnostics))
  assert.deepEqual(result.diagnostics,[])
  assert.equal(result.edits.length,c.count)
  assert.deepEqual([...result.edits.map(e=>e.line)].sort((a,b)=>a-b),
    [...c.lines].sort((a,b)=>a-b))
  assert.ok(result.edits.every(e=>e.oldText===c.name && e.newText===c.newName))
  assert.ok(result.edits.every(e=>!c.excluded.includes(e.line)))
  for(const edit of result.edits) {
    assert.ok(path.relative(dir,edit.file).length>0)
    assert.ok(!path.relative(dir,edit.file).startsWith('..'))
    const content=fs.readFileSync(edit.file,'utf8')
    assert.equal(content.slice(edit.start,edit.end),edit.oldText)
    const line=content.split(/\r?\n/)[edit.line-1]
    assert.equal(line.slice(edit.column-1,edit.column-1+edit.oldText.length),edit.oldText)
  }
  assert.deepEqual(snapshot(dir),before,'Original files must remain byte-for-byte unchanged')
  console.log(`RENAME_READONLY_PREVIEW_PASS ${c.symbol} edits=${c.count}`)
}

function expectReject(folder, project, symbol, name, why) {
  const original=snapshot(folder)
  const result=probe(folder,project,symbol,name)
  assert.equal(result.probeOnly,true)
  assert.equal(result.mutationSupported,false)
  assert.equal(result.accepted,false,'should fail closed: '+why)
  assert.deepEqual(result.edits,[],'no partial edits on failure')
  assert.ok(result.diagnostics.length>=1)
  assert.deepEqual(snapshot(folder),original,'rejected preview mutated original')
  console.log(`RENAME_FAIL_CLOSED_PASS ${why}: ${result.diagnostics[0]}`)
}
const responsibility=path.join(root,'fixtures','responsibility-proof')
expectReject(responsibility,'Responsibility.FeatureTests.csproj',
  'User.Authenticate(int)','AuthenticateAttempts','unregistered-overload')
expectReject(responsibility,'Responsibility.FeatureTests.csproj',
  'User.Authenticate(string)','Authenticate','unchanged-name')
expectReject(responsibility,'Responsibility.FeatureTests.csproj',
  'User.Authenticate(string)','class','reserved-keyword')
expectReject(responsibility,'Responsibility.FeatureTests.csproj',
  'User.Authenticate(string)','2bad','invalid-identifier')
const clonedRoots=[]
try {
  const clone=fs.mkdtempSync(path.join(os.tmpdir(),'fp-rename-adversarial-'))
  clonedRoots.push(clone)
  fs.cpSync(responsibility,clone,{recursive:true,
    filter:filepath=>!['obj','bin','node_modules'].includes(path.basename(filepath))})
  const config=path.join(clone,'FeatureProjectionConfig.cs')
  const source=fs.readFileSync(config,'utf8')
  // A different overload with the desired name must still block the preview.
  const updated=source.replace(
    'void Authenticate(int attempt);',
    'void Authenticate(int attempt);\n    void AuthenticateCredentials(int attempt);')
  assert.notEqual(source,updated)
  fs.writeFileSync(config,updated)
  execute('dotnet',['restore',path.join(clone,'Responsibility.FeatureTests.csproj'),'--nologo'])
  expectReject(clone,'Responsibility.FeatureTests.csproj',
    'User.Authenticate(string)','AuthenticateCredentials','existing-overload-collision')

  const duplicate=fs.mkdtempSync(path.join(os.tmpdir(),'fp-rename-duplicate-'))
  clonedRoots.push(duplicate)
  fs.cpSync(responsibility,duplicate,{recursive:true,
    filter:filepath=>!['obj','bin','node_modules'].includes(path.basename(filepath))})
  const config2=path.join(duplicate,'FeatureProjectionConfig.cs')
  const before2=fs.readFileSync(config2,'utf8')
  const registered='builder.RegisterResponsibility<User>(x => x.Authenticate(default(string)!));'
  assert.equal(before2.split(registered).length,2)
  fs.writeFileSync(config2,before2.replace(registered,registered+'\n        '+registered))
  execute('dotnet',['restore',path.join(duplicate,'Responsibility.FeatureTests.csproj'),'--nologo'])
  expectReject(duplicate,'Responsibility.FeatureTests.csproj',
    'User.Authenticate(string)','AuthenticateCredentials','duplicate-registered-symbol')
} finally {
  for(const clone of clonedRoots)
    fs.rmSync(clone,{recursive:true,force:true,maxRetries:3,retryDelay:250})
}
console.log('P2_8_3C_READONLY_ROSLYN_RENAME_FEASIBILITY_PASS edits=7 mutating_operations=0')
