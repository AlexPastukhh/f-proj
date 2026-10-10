import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { runFullPrototype } = require('../dist/core/fullEngine.js')
const { validatePrototypeConfig } = require('../dist/core/configValidation.js')

function tempRoot() { return fs.mkdtempSync(path.join(os.tmpdir(), 'feature-projection-config-')) }

const baseOptions = (workspaceRoot, config) => ({
  workspaceRoot,
  config,
  trusted:true,
  vitestWorkerPath:path.join(workspaceRoot,'missing-worker.mjs'),
  dotnetWorkerDll:path.join(workspaceRoot,'missing-worker.dll'),
})

test('empty featureSpaces is blocking instead of reporting an empty Fresh projection', async () => {
  const root = tempRoot()
  const out = await runFullPrototype(baseOptions(root, {featureSpaces:[]}))
  const diag = out.diagnostics.find(x => x.ruleId === 'feature-projection/no-feature-spaces')
  assert.ok(diag)
  assert.equal(diag.projectionImpact, 'blocks-part')
  assert.equal(out.joined.length, 0)
})

test('xUnit source without projectFile is rejected before worker invocation', async () => {
  const root = tempRoot()
  fs.mkdirSync(path.join(root,'backend','Features'), {recursive:true})
  const config = {featureSpaces:[{id:'app',sources:[{
    id:'backend',role:'backend',root:'backend/Features',adapter:'xunit-v3',frameworkProject:'backend'
  }]}]}
  const out = await runFullPrototype(baseOptions(root, config))
  const diag = out.diagnostics.find(x => x.ruleId === 'feature-projection/missing-project-file')
  assert.ok(diag)
  assert.equal(diag.severity, 'error')
  assert.equal(diag.projectionImpact, 'blocks-part')
  assert.equal(out.definitions.length, 0)
})


test('source id is required independently of role', () => {
  const root = tempRoot()
  fs.mkdirSync(path.join(root,'frontend','src','features'), {recursive:true})
  fs.mkdirSync(path.join(root,'frontend'), {recursive:true})
  const config = {featureSpaces:[{id:'app',sources:[{
    role:'frontend',root:'frontend/src/features',adapter:'vitest-5',frameworkProject:'frontend'
  }]}]}
  const out = validatePrototypeConfig(config, root)
  assert.ok(out.diagnostics.some(x => x.ruleId === 'feature-projection/missing-source-id'))
})

test('Vitest configFile is resolved relative to frameworkProject and missing file blocks config', () => {
  const root = tempRoot()
  fs.mkdirSync(path.join(root,'frontend','src','features'), {recursive:true})
  const config = {featureSpaces:[{id:'app',sources:[{
    id:'frontend',role:'frontend',root:'frontend/src/features',adapter:'vitest-5',frameworkProject:'frontend',configFile:'vitest.custom.ts'
  }]}]}
  const missing = validatePrototypeConfig(config, root)
  assert.ok(missing.diagnostics.some(x => x.ruleId === 'feature-projection/config-file-missing'))
  fs.writeFileSync(path.join(root,'frontend','vitest.custom.ts'), 'export default {}', 'utf8')
  const valid = validatePrototypeConfig(config, root)
  assert.equal(valid.diagnostics.length, 0)
  assert.equal(valid.valid.length, 1)
})
