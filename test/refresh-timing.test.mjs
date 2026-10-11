import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const {readPrototypeConfig}=require('../dist/core/config.js')
const {runFullPrototype}=require('../dist/core/fullEngine.js')
const workspace=path.resolve('fixtures')
const config=readPrototypeConfig(path.join(workspace,'feature-projection.config.json'))
const options={
  workspaceRoot:workspace,config,trusted:false,
  vitestWorkerPath:path.resolve('workers/vitest-materialize.mjs'),
  dotnetWorkerDll:path.resolve('not-present-worker.dll'),
}
test('timings observe untrusted sources and never change Projection semantics',async()=>{
  const original=await runFullPrototype(options)
  const observed=[]
  const result=await runFullPrototype({...options,onTiming:s=>observed.push(s)})
  assert.deepEqual(result,original)
  assert.deepEqual(observed.map(s=>s.phase),['validate','vitest-static','expand','join','render'])
  assert.ok(observed.every(s=>Number.isFinite(s.elapsedMs)&&s.elapsedMs>=0))
  assert.deepEqual(observed.filter(s=>s.sourceId).map(s=>[s.featureSpaceId,s.sourceId]),
    [['app','frontend']])
  assert.ok(!observed.some(s=>s.phase.startsWith('xunit-')))
  assert.ok(!observed.some(s=>s.phase.includes('materialize')))
  assert.ok(observed.every(s=>Object.keys(s).every(k=>
    ['phase','elapsedMs','featureSpaceId','sourceId'].includes(k))))
})
test('throwing timing observer cannot break trusted boundaries or results',async()=>{
  const original=await runFullPrototype(options)
  const failedObserver=await runFullPrototype({...options,onTiming:()=>{throw Error('sink-failure')}})
  assert.deepEqual(failedObserver,original)
})
