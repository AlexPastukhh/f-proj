import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { runJsonWorker } = require('../dist/core/process.js')

test('worker timeout kills a hung materializer', async () => {
  const worker = path.resolve('fixtures/mock/hang-worker.mjs')
  const out = await runJsonWorker(process.execPath, [worker], {}, process.cwd(), 100)
  assert.equal(out.ok, false)
  assert.equal(out.timedOut, true)
})

test('generic process runner captures successful stdout', async () => {
  const { runProcess } = require('../dist/core/process.js')
  const out = await runProcess(process.execPath, ['-e', 'process.stdout.write("ok")'], process.cwd(), 3000)
  assert.equal(out.ok, true)
  assert.equal(out.stdout, 'ok')
})
