import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const root = path.resolve(import.meta.dirname, '..')
const work = path.join(root, 'fixtures', 'parameterized-navigation-proof')
const frontend = path.join(work, 'frontend')
const backend = path.join(work, 'backend')
const worker = path.join(root, 'workers', 'dotnet', 'bin', 'Release', 'net8.0', 'FeatureProjection.DotNetWorker.dll')
const vitestWorker = path.join(root, 'workers', 'vitest-materialize.mjs')

function exec(command, args) {
  const out = spawnSync(command, args, { cwd:root, encoding:'utf8', windowsHide:true, timeout:120000, maxBuffer:4*1024*1024 })
  if (out.error || out.status !== 0) throw Error(`${command} ${args.join(' ')}: ${out.error?.message ?? ''}\n${out.stdout}\n${out.stderr}`)
}

if (process.env.FP_NAV_SKIP_BUILD !== '1') {
  exec(process.execPath, [path.join(root,'node_modules','typescript','bin','tsc'),'-p','tsconfig.json'])
  exec('dotnet', ['build', path.join(root,'workers','dotnet','FeatureProjection.DotNetWorker.csproj'), '-c','Release','--no-restore','--nologo'])
  exec('dotnet', ['build', path.join(backend,'Navigation.FeatureTests.csproj'), '-c','Release','--no-restore','--nologo'])
}

const { runFullPrototype } = require('../dist/core/fullEngine.js')
const { renderProjection } = require('../dist/core/projection.js')
const { buildTestingTree } = require('../dist/core/testingTree.js')
const { analyzeVitestSource } = require('../dist/adapters/vitestSource.js')
const sourceFrontend = {id:'frontend',role:'frontend',adapter:'vitest-5',root:'frontend/src/features',frameworkProject:'frontend'}
const sourceBackend = {id:'backend',role:'backend',adapter:'xunit-v3',root:'backend/Features',frameworkProject:'backend',projectFile:'Navigation.FeatureTests.csproj'}

const staticDefs = analyzeVitestSource(sourceFrontend,'app',work)
assert.equal(staticDefs.length,1)
assert.deepEqual(staticDefs[0].caseSourceAnchors.map(a=>[a.label,a.source.line]),[['expired',4],['locked',5]])
const dynamicDef = analyzeVitestSource(
  {id:'frontend',role:'frontend',adapter:'vitest-5',root:'fixtures/workspace/frontend/src/features',frameworkProject:'fixtures/workspace/frontend'},
  'app',root,
).find(d => d.isParameterized)
assert.ok(dynamicDef)
assert.deepEqual(dynamicDef.caseSourceAnchors,[],'computed test.each input must not guess exact source rows')

const result = await runFullPrototype({
  workspaceRoot:work, config:{featureSpaces:[{id:'app',sources:[sourceFrontend,sourceBackend]}],workerTimeoutMs:30000,buildTimeoutMs:120000},
  trusted:true,vitestWorkerPath:vitestWorker,dotnetWorkerDll:worker,vitestNodeRuntime:{command:process.execPath},
})
console.log('NAV_CASE_REFS='+JSON.stringify(result.cases.map(c=>({id:c.situationId,adapter:c.definitionRef.adapterId,ref:c.definitionRef.frameworkDefinitionKey}))))
console.log('NAV_DEFINITION_REFS='+JSON.stringify(result.definitions.filter(d=>d.isParameterized).map(d=>({adapter:d.adapterId,ref:d.definitionRef.frameworkDefinitionKey,line:d.source.line,taskLine:d.definitionRef.frameworkTaskLine}))))
const blocking = result.diagnostics.filter(d => d.projectionImpact === 'blocks-part')
if (blocking.length) console.log('NAVIGATION_BLOCKING_DIAGNOSTICS='+JSON.stringify(blocking.map(d=>({ruleId:d.ruleId,message:d.message}))))
assert.deepEqual(blocking,[], 'real framework materialization must have no blocking diagnostics')
assert.equal(result.joined.length,2)
assert.equal(result.cases.length,4)
assert.deepEqual(result.joined.map(j=>j.situation),['expired','locked'])
const expectedLines = {expired:{frontend:4,backend:5},locked:{frontend:5,backend:6}}
for (const row of result.joined) {
  assert.equal(row.featureSpaceId,'app')
  assert.equal(row.logicalFolderKey,'access')
  for (const role of ['frontend','backend']) {
    const part=row[role]
    assert.ok(part, `${role} missing from ${row.situation}`)
    assert.equal(part.navigationSource?.line,expectedLines[row.situation][role],`${role} concrete row link`)
    assert.notEqual(part.navigationSource.line,part.source.line,'exact row must not be the shared definition')
    assert.ok(fs.existsSync(part.navigationSource.file))
    assert.equal(part.navigationSource.file,part.source.file)
    const file=fs.readFileSync(part.navigationSource.file,'utf8')
    assert.ok(file.slice(part.navigationSource.start,part.navigationSource.end).includes(row.situation),'anchor text must contain the framework label')
    assert.ok(part.assertions.length,'definition-level literal assertions must remain attached')
    assert.ok(part.assertions.every(a=>file.includes(a.sourceCode)), 'literal assertions remain actual source code')
  }
}
const rendered=renderProjection(result.joined, {
  sourceHref:(range)=>`nav:${range.line}`,
})
assert.equal(rendered.sourceActions.length,4)
assert.deepEqual(rendered.sourceActions.map(a=>a.source.line),[4,5,5,6])
for(const line of [4,5,6]) assert.ok(rendered.markdown.includes(`nav:${line}`))
const tree=buildTestingTree(result.joined,result.definitions,result.diagnostics)
const parts=tree.flatMap(f=>f.children.flatMap(o=>o.children.flatMap(s=>s.children)))
assert.equal(parts.length,4)
for(const row of result.joined) {
 const label=row.situation
 const situationNode=tree[0].children[0].children.find(s=>s.label===label)
 assert.ok(situationNode)
 for(const partNode of situationNode.children) assert.equal(partNode.source.line,expectedLines[label][partNode.role])
}
console.log('PARAMETERIZED_NAVIGATION_PROOF_PASS frameworks=2 cases=4 joined=2 exact_source_actions=4 fallback_dynamic_definition=PASS')
