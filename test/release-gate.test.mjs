import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

const { resolveXunitBuildTimeout, runFullPrototype } = require('../dist/core/fullEngine.js')
const { isFeatureProjectionTestMode } = require('../dist/core/testMode.js')
const { classifyNodePrerequisiteFailure, classifyDotnetPrerequisiteFailure } = require('../dist/core/runtimePrerequisites.js')
const { materializeVitest } = require('../dist/adapters/vitestMaterializer.js')

test('public buildTimeoutMs controls trusted xUnit project-build timeout', () => {
  assert.equal(resolveXunitBuildTimeout({ featureSpaces:[], buildTimeoutMs: 45678 }), 45678)
  assert.equal(resolveXunitBuildTimeout({ featureSpaces:[], workerTimeoutMs: 1000 }), 120000)
})

test('hidden automation commands are enabled only by explicit test-mode switch', () => {
  assert.equal(isFeatureProjectionTestMode({ FEATURE_PROJECTION_TEST_MODE:'1' }), true)
  assert.equal(isFeatureProjectionTestMode({ FEATURE_PROJECTION_TEST_MODE:'true' }), false)
  assert.equal(isFeatureProjectionTestMode({}), false)
})

test('missing external Node is classified as an actionable Vitest prerequisite diagnostic', async () => {
  const direct = classifyNodePrerequisiteFailure('spawn missing-node ENOENT')
  assert.equal(direct?.ruleId, 'worker/node-runtime-missing')
  assert.match(direct?.message ?? '', /featureProjection\.nodePath/)

  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'feature-projection-node-prereq-'))
  const source = { id:'frontend', role:'frontend', root:'.', adapter:'vitest-5', frameworkProject:'.' }
  const definition = {
    id:'d', featureSpaceId:'app', logicalFolderKey:'shared', partRole:'frontend', adapterId:'vitest-5', frameworkProject:workspace,
    isParameterized:true, featureName:'access', outcome:'denied', expectedBehavior:'stays_blocked', assertions:[],
    source:{ file:path.join(workspace,'feature.test.ts'), line:1, column:1 },
    definitionRef:{ adapterId:'vitest-5', frameworkProject:workspace, frameworkDefinitionKey:'feature.test.ts:1:1', sourceFile:path.join(workspace,'feature.test.ts'), sourceLine:1 },
    diagnostics:[],
  }
  const missing = path.join(workspace, process.platform === 'win32' ? 'missing-node.exe' : 'missing-node')
  const out = await materializeVitest(source, [definition], workspace, path.join(workspace,'worker.mjs'), 2000, { command:missing })
  assert.equal(out.diagnostics[0]?.ruleId, 'worker/node-runtime-missing')
  assert.match(out.diagnostics[0]?.message ?? '', /Install Node\.js/)
})

test('missing or incompatible dotnet is classified as an actionable xUnit prerequisite diagnostic', async () => {
  assert.equal(classifyDotnetPrerequisiteFailure('spawn dotnet ENOENT')?.ruleId, 'worker/dotnet-prerequisite-unavailable')
  assert.equal(classifyDotnetPrerequisiteFailure(undefined, 'You must install or update .NET to run this application.')?.ruleId, 'worker/dotnet-prerequisite-unavailable')

  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'feature-projection-dotnet-prereq-'))
  fs.mkdirSync(path.join(workspace,'Features'))
  fs.writeFileSync(path.join(workspace,'Test.csproj'), '<Project Sdk="Microsoft.NET.Sdk"></Project>')
  const worker = path.join(workspace,'FeatureProjection.DotNetWorker.dll')
  fs.writeFileSync(worker, '')
  const oldPath = process.env.PATH
  const oldPathAlt = process.env.Path
  try {
    process.env.PATH = workspace
    process.env.Path = workspace
    const out = await runFullPrototype({
      workspaceRoot:workspace,
      config:{ featureSpaces:[{ id:'app', sources:[{ id:'backend', role:'backend', root:'Features', adapter:'xunit-v3', frameworkProject:'.', projectFile:'Test.csproj' }] }] },
      trusted:true,
      vitestWorkerPath:path.join(workspace,'worker.mjs'),
      dotnetWorkerDll:worker,
    })
    assert.ok(out.diagnostics.some(d => d.ruleId === 'worker/dotnet-prerequisite-unavailable'), JSON.stringify(out.diagnostics))
    assert.match(out.diagnostics.find(d => d.ruleId === 'worker/dotnet-prerequisite-unavailable')?.message ?? '', /compatible \.NET SDK\/runtime/)
  } finally {
    if (oldPath === undefined) delete process.env.PATH; else process.env.PATH = oldPath
    if (oldPathAlt === undefined) delete process.env.Path; else process.env.Path = oldPathAlt
  }
})
