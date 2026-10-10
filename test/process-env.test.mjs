import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { runJsonWorker } = require('../dist/core/process.js')
const { sanitizeExternalNodeEnvironment } = require('../dist/core/nodeRuntime.js')

test('worker launcher forwards explicit environment to a separate Node process', async () => {
  const worker = path.resolve('fixtures/mock/echo-env-worker.mjs')
  const result = await runJsonWorker(process.execPath, [worker], {hello:'world'}, process.cwd(), 3000, {
    env:{...process.env, FEATURE_PROJECTION_TEST_ENV:'visible'},
  })
  assert.equal(result.ok, true)
  assert.equal(result.value.value, 'visible')
  assert.equal(result.value.input.hello, 'world')
})


test('sanitized environment prevents inherited NODE_OPTIONS bootloader from breaking a child Node worker', async () => {
  const worker = path.resolve('fixtures/mock/echo-env-worker.mjs')
  const inherited = {
    ...process.env,
    NODE_OPTIONS:`--require ${path.resolve('fixtures/mock/definitely-missing-vscode-debug-bootloader.js')}`,
    VSCODE_INSPECTOR_OPTIONS:'{"inspectorIpc":"synthetic"}',
  }
  const sanitized = sanitizeExternalNodeEnvironment(inherited)
  const result = await runJsonWorker(process.execPath, [worker], {hello:'clean-child'}, process.cwd(), 3000, {
    env:{...sanitized.env, FEATURE_PROJECTION_TEST_ENV:'clean'},
  })
  assert.equal(result.ok, true)
  assert.equal(result.value.value, 'clean')
  assert.equal(result.value.input.hello, 'clean-child')
})
