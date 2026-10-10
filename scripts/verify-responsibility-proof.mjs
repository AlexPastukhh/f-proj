import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const root = path.resolve(import.meta.dirname, '..')
const project = path.join(root, 'fixtures', 'responsibility-proof')
const projectFile = path.join(project, 'Responsibility.FeatureTests.csproj')
const workerFile = path.join(root, 'workers', 'dotnet', 'bin', 'Release', 'net8.0', 'FeatureProjection.DotNetWorker.dll')

function run(command, args, input) {
  const result = spawnSync(command, args, {
    cwd: root, input, encoding: 'utf8', windowsHide: true,
    maxBuffer: 10 * 1024 * 1024, timeout: 120_000,
  })
  if (result.error || result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed: ${result.error?.message ?? ''}\n${result.stdout}\n${result.stderr}`)
  }
  return result.stdout
}

run('dotnet', ['build', path.join(root, 'workers', 'dotnet', 'FeatureProjection.DotNetWorker.csproj'), '-c', 'Release', '--no-restore', '--nologo'])
run('dotnet', ['build', projectFile, '-c', 'Release', '--no-restore', '--nologo'])
run('dotnet', [path.join(project, 'bin', 'Release', 'net8.0', 'Responsibility.FeatureTests.dll'), '-nologo'])
run(process.execPath, [path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'tsconfig.json'])

const sourceFile = path.join(project, 'Features', 'auth', 'AccessFeatureTests.cs')
const input = JSON.stringify({
  command:'analyze', featureSpaceId:'app',
  source:{
    id:'backend', role:'backend', root:path.join(project, 'Features'),
    adapter:'xunit-v3', frameworkProject:project, projectFile,
  },
})
const raw = JSON.parse(run('dotnet', [workerFile], input))
assert.deepEqual(raw.diagnostics, [])
assert.equal(raw.definitions.length, 1)

const definition = raw.definitions[0]
assert.equal(definition.rawDescription, 'access__denied__invalid_password__authentication_is_rejected')
assert.equal(definition.assertions.length, 2)
const registered = definition.assertions.find(a => a.kind === 'responsibility')
assert.ok(registered, 'registered user.Verify must be projected')
assert.equal(registered.sourceCode, 'user.Verify(x => x.Authenticate("invalid"), Times.Once);')
assert.ok(fs.readFileSync(sourceFile, 'utf8').includes(registered.sourceCode), 'verification must remain literal source text')
assert.equal(registered.source.file.toLowerCase(), sourceFile.toLowerCase())
assert.equal(definition.assertions.filter(a => a.kind === 'assertion').length, 1)
assert.equal(definition.assertions.find(a => a.kind === 'assertion').sourceCode, 'Assert.True(true);')
assert.ok(!definition.assertions.some(a => /Authenticate\(42\)|logger\.Verify/.test(a.sourceCode)), 'unregistered verifications cannot leak')

const { normalizeDotnetDefinitions } = require('../dist/adapters/dotnetClient.js')
const { expandDefinitions, joinParts, renderMarkdown } = require('../dist/core/projection.js')
const normalized = normalizeDotnetDefinitions(raw.definitions)
const expanded = expandDefinitions(normalized, [])
assert.deepEqual(expanded.diagnostics, [])
assert.equal(expanded.parts.length, 1)
assert.equal(expanded.parts[0].trust, 'trusted')
const joined = joinParts(expanded.parts)
assert.equal(joined.length, 1)
assert.ok(joined[0].backend && !joined[0].frontend)
assert.equal(joined[0].backend.assertions.find(a => a.kind === 'responsibility').sourceCode, registered.sourceCode)
const markdown = renderMarkdown(joined)
assert.ok(markdown.includes(registered.sourceCode))
assert.ok(!markdown.includes('logger.Verify'))
assert.ok(!markdown.includes('Authenticate(42)'))

console.log('RESPONSIBILITY_PROOF_PASS definitions=1 assertions=2 responsibility=1 unregistered=0 joined=1')
