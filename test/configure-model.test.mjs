import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { applySourceConfigurationChange } = require('../dist/core/configureModel.js')

const frontend = {
  id:'frontend', role:'frontend', root:'frontend/src/features', adapter:'vitest-5', frameworkProject:'frontend'
}
const backend = {
  id:'backend', role:'backend', root:'backend/Features', adapter:'xunit-v3', frameworkProject:'backend', projectFile:'Backend.FeatureTests.csproj'
}

test('Configure model adds a new FeatureSpace/source without mutating input', () => {
  const original = {featureSpaces:[], workerTimeoutMs:15000}
  const out = applySourceConfigurationChange(original, {featureSpaceId:'app', source:frontend})
  assert.deepEqual(original.featureSpaces, [])
  assert.equal(out.featureSpaces.length, 1)
  assert.equal(out.featureSpaces[0].id, 'app')
  assert.deepEqual(out.featureSpaces[0].sources, [frontend])
  assert.equal(out.workerTimeoutMs, 15000)
})

test('Configure model preserves existing sources when adding another source', () => {
  const original = {featureSpaces:[{id:'app',sources:[frontend]}]}
  const out = applySourceConfigurationChange(original, {featureSpaceId:'app', source:backend})
  assert.deepEqual(out.featureSpaces[0].sources.map(x => x.id), ['frontend','backend'])
})

test('Configure model can rename/edit exactly the selected source', () => {
  const original = {featureSpaces:[{id:'app',sources:[frontend,backend]}]}
  const renamed = {...frontend,id:'web'}
  const out = applySourceConfigurationChange(original, {featureSpaceId:'app', source:renamed, replaceSourceId:'frontend'})
  assert.deepEqual(out.featureSpaces[0].sources.map(x => x.id), ['backend','web'])
})
