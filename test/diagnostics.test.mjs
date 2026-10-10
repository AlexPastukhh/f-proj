import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { analyzeVitestSource } = require('../dist/adapters/vitestSource.js')
const { expandDefinitions, joinParts } = require('../dist/core/projection.js')

function analyze(code) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'feature-projection-'))
  const feature = path.join(root, 'features', 'login')
  fs.mkdirSync(feature, { recursive:true })
  fs.writeFileSync(path.join(feature, 'login.feature.test.ts'), code)
  return analyzeVitestSource({id:'f',role:'frontend',root:'features',adapter:'vitest-5',frameworkProject:'.'}, 'app', root)
}

test('no recognized assertions is a warning/degraded diagnostic', () => {
  const [d] = analyze(`test('login__session_expired__refresh_token_expired__reauthentication_is_required', async () => { await resumeSession() })`)
  const diag = d.diagnostics.find(x => x.ruleId === 'feature-test/no-recognized-assertions')
  assert.ok(diag)
  assert.equal(diag.category, 'projection-safety')
  assert.equal(diag.severity, 'warning')
  assert.equal(diag.projectionImpact, 'degrades-part')
  const expanded = expandDefinitions([d], [])
  assert.equal(expanded.parts.length, 1)
  assert.equal(expanded.parts[0].trust, 'degraded')
  assert.equal(expanded.parts[0].assertions.length, 0)
})

test('if blocks the feature-test part', () => {
  const [d] = analyze(`test('login__session_expired__refresh_token_expired__reauthentication_is_required', async () => { if (ready) expect(true).toBe(true) })`)
  const diag = d.diagnostics.find(x => x.ruleId === 'feature-test/no-if')
  assert.ok(diag)
  assert.equal(diag.category, 'projection-safety')
  assert.equal(diag.severity, 'warning')
  assert.equal(diag.projectionImpact, 'blocks-part')
  const expanded = expandDefinitions([d], [])
  assert.equal(expanded.parts.length, 0)
  assert.equal(joinParts(expanded.parts).length, 0)
})

test('unsupported top-level control flow blocks the feature-test part', () => {
  const [d] = analyze(`test('login__session_expired__refresh_token_expired__reauthentication_is_required', () => { for (const attempt of [1,2]) { expect(attempt).toBe(1) } })`)
  const diag = d.diagnostics.find(x => x.ruleId === 'feature-test/unsupported-control-flow')
  assert.ok(diag)
  assert.equal(diag.category, 'projection-safety')
  assert.equal(diag.severity, 'warning')
  assert.equal(diag.projectionImpact, 'blocks-part')
  const expanded = expandDefinitions([d], [])
  assert.equal(expanded.parts.length, 0)
  assert.equal(joinParts(expanded.parts).length, 0)
})
