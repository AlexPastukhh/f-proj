import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const root = path.resolve(import.meta.dirname, '..')
const project = path.join(root, 'fixtures', 'assertion-helper-proof')
const projectFile = path.join(project, 'AssertionHelper.FeatureTests.csproj')
const workerProject = path.join(root, 'workers', 'dotnet', 'FeatureProjection.DotNetWorker.csproj')
const workerDll = path.join(root, 'workers', 'dotnet', 'bin', 'Release', 'net8.0', 'FeatureProjection.DotNetWorker.dll')
const fixtureDll = path.join(project, 'bin', 'Release', 'net8.0', 'AssertionHelper.FeatureTests.dll')
const testFile = path.join(project, 'Features', 'access', 'AccessFeatureTests.cs')

function run(command, args, input) {
  const result = spawnSync(command, args, {cwd:root, input, encoding:'utf8', windowsHide:true, timeout:120000, maxBuffer:8*1024*1024})
  if (result.error || result.status !== 0)
    throw new Error(`${command} ${args.join(' ')} failed: ${result.error?.message ?? ''}\n${result.stdout}\n${result.stderr}`)
  return result.stdout
}

run('dotnet', ['build', workerProject, '-c', 'Release', '--no-restore', '--nologo'])
run('dotnet', ['build', projectFile, '-c', 'Release', '--no-restore', '--nologo'])
const fixtureRun = run('dotnet', [fixtureDll, '-nologo'])
assert.match(fixtureRun, /Total:\s*1,\s*Errors:\s*0,\s*Failed:\s*0/)
run(process.execPath, [path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'tsconfig.json'])

const input = JSON.stringify({
  command:'analyze', featureSpaceId:'app',
  source:{id:'backend',role:'backend',adapter:'xunit-v3',root:path.join(project,'Features'),frameworkProject:project,projectFile},
})
const result = JSON.parse(run('dotnet', [workerDll], input))
assert.deepEqual(result.diagnostics, [])
assert.equal(result.definitions.length, 1)
const definition = result.definitions[0]
assert.equal(definition.rawDescription, 'access__denied__invalid_token__request_is_rejected')
assert.equal(definition.assertions.length, 2, 'registered helper plus framework assertion, no other calls')
assert.ok(definition.assertions.every(a => a.kind === 'assertion'))
const literalHelper = 'FeatureChecks.AssertDenied(false);'
const literalFramework = 'Assert.True(true);'
assert.deepEqual(definition.assertions.map(a => a.sourceCode), [literalHelper, literalFramework])
const sourceCode = fs.readFileSync(testFile, 'utf8')
for (const a of definition.assertions) {
  assert.equal(path.resolve(a.source.file).toLowerCase(), path.resolve(testFile).toLowerCase())
  assert.equal(sourceCode.slice(a.source.start, a.source.end), a.sourceCode, 'literal source/range must match')
}
assert.ok(!definition.assertions.some(a => /AssertDenied\("context"\)|UnrelatedChecks|Telemetry/.test(a.sourceCode)))

const { normalizeDotnetDefinitions } = require('../dist/adapters/dotnetClient.js')
const { expandDefinitions, joinParts, renderMarkdown } = require('../dist/core/projection.js')
const normalized = normalizeDotnetDefinitions(result.definitions)
assert.equal(normalized[0].featureName, 'access')
assert.equal(normalized[0].outcome, 'denied')
assert.equal(normalized[0].directSituation, 'invalid_token')
assert.equal(normalized[0].expectedBehavior, 'request_is_rejected')
const expanded = expandDefinitions(normalized, [])
assert.deepEqual(expanded.diagnostics, [])
assert.equal(expanded.parts.length, 1)
assert.equal(expanded.parts[0].trust, 'trusted')
const joined = joinParts(expanded.parts)
assert.equal(joined.length, 1)
assert.ok(joined[0].backend && !joined[0].frontend)
assert.deepEqual(joined[0].backend.assertions.map(a => a.sourceCode), [literalHelper,literalFramework])
const markdown = renderMarkdown(joined)
assert.ok(markdown.includes(literalHelper))
assert.ok(markdown.includes(literalFramework))
assert.ok(!/AssertDenied\("context"\)|UnrelatedChecks|Telemetry/.test(markdown))
console.log('CUSTOM_ASSERTION_PROOF_PASS tests=1 definitions=1 assertions=2 registered=1 unregistered=0 joined=1')
