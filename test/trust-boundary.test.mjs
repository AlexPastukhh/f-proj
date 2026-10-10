import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { runFullPrototype } = require('../dist/core/fullEngine.js')

const workspaceRoot = path.resolve('fixtures')
const config = JSON.parse(fs.readFileSync(path.resolve('fixtures/feature-projection.config.json'), 'utf8'))

test('untrusted run keeps all project/runtime workers behind the trust boundary', async () => {
  const logs = []
  const out = await runFullPrototype({
    workspaceRoot,
    config,
    trusted:false,
    vitestWorkerPath:path.resolve('missing-vitest-worker.mjs'),
    dotnetWorkerDll:path.resolve('missing-dotnet-worker.dll'),
    vitestNodeRuntime:{ command:path.resolve('missing-node.exe') },
    log:line => logs.push(String(line)),
  })

  const ruleIds = out.diagnostics.map(d => d.ruleId)
  assert.ok(ruleIds.includes('worker/untrusted-workspace'), 'parameterized Vitest evidence must be explicitly blocked')
  assert.ok(ruleIds.includes('worker/untrusted-project-analysis'), 'C# project-backed analysis must be explicitly blocked')
  assert.ok(!ruleIds.includes('worker/dotnet-worker-missing'), 'untrusted C# must not inspect/require the .NET worker')
  assert.equal(out.cases.length, 0, 'untrusted run must materialize no framework cases')
  assert.equal(out.definitions.filter(d => d.partRole === 'backend').length, 0, 'untrusted run must not produce Roslyn/MSBuild-backed C# definitions')
  assert.ok(out.definitions.some(d => d.partRole === 'frontend'), 'safe TypeScript source-only definitions may remain available')
  assert.match(out.markdown, /Situation: refresh_token_expired/)
  assert.match(out.markdown, /Backend: \[unmatched\]/)
  assert.ok(!logs.some(line => /spawn|dotnet-analyze|dotnet-build|xunit-materialize/.test(line)), `unexpected worker log: ${logs.join('\n')}`)
})

test('partial Vitest worker failure leaves source-only evidence explicitly incomplete', async () => {
  const frontend = config.featureSpaces.flatMap(space => space.sources).find(source => source.adapter === 'vitest-5')
  assert.ok(frontend)
  const out = await runFullPrototype({
    workspaceRoot,
    config:{featureSpaces:[{id:'app',sources:[frontend]}], workerTimeoutMs:3000},
    trusted:true,
    vitestWorkerPath:path.resolve('fixtures/mock/fail-stdout-worker.mjs'),
    dotnetWorkerDll:path.resolve('missing-dotnet-worker.dll'),
    vitestNodeRuntime:{command:process.execPath},
  })
  const failed = out.diagnostics.find(d => d.ruleId === 'worker/vitest-materialization-failed')
  assert.ok(failed)
  assert.equal(failed.category, 'runtime')
  assert.equal(failed.severity, 'error')
  assert.equal(failed.projectionImpact, 'blocks-part')
  assert.ok(out.diagnostics.some(d => d.ruleId === 'feature-test/resolvable-situation' && d.projectionImpact === 'blocks-part'))
  assert.equal(out.cases.length, 0)
  assert.equal(out.parts.length, 1, 'the source-only non-parameterized part remains')
  assert.equal(out.joined.length, 1)
  assert.equal(out.joined[0].situation, 'refresh_token_expired')
  assert.ok(out.joined[0].frontend)
  assert.equal(out.joined[0].backend, undefined)
  assert.ok(!out.joined.some(s => s.outcome === 'invalid_user_input'), 'failed cases must not appear as complete')
})
