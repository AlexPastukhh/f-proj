import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const root = path.resolve(import.meta.dirname, '..')
const workspaceRoot = path.join(root, 'fixtures')
const config = JSON.parse(fs.readFileSync(path.join(workspaceRoot, 'feature-projection.config.json'), 'utf8'))
const { runFullPrototype } = require('../dist/core/fullEngine.js')
const { renderProjection } = require('../dist/core/projection.js')
const { buildTestingTree } = require('../dist/core/testingTree.js')

const result = await runFullPrototype({
  workspaceRoot,
  config,
  trusted: true,
  vitestWorkerPath: path.join(root, 'workers', 'vitest-materialize.mjs'),
  dotnetWorkerDll: path.join(root, 'workers', 'dotnet', 'bin', 'Release', 'net8.0', 'FeatureProjection.DotNetWorker.dll'),
  vitestNodeRuntime: { command: process.execPath },
})
const errors = result.diagnostics.filter(d => d.projectionImpact === 'blocks-part')
assert.deepEqual(errors, [], 'primary trusted framework discovery must stay complete')
assert.equal(result.cases.length, 4, 'two native cases per dynamic provider')
assert.equal(result.joined.length, 3, 'two dynamic Situations plus one nonparameterized Situation')

const expected = ['email_has_invalid_format', 'passwords_dont_match']
const dynamic = result.joined.filter(j => expected.includes(j.situation))
assert.deepEqual(dynamic.map(j => j.situation), expected)
for (const situation of dynamic) {
  assert.equal(situation.featureSpaceId, 'app')
  assert.equal(situation.logicalFolderKey, 'login')
  assert.equal(situation.featureName, 'login')
  assert.equal(situation.outcome, 'invalid_user_input')
  const frontend = situation.frontend
  const backend = situation.backend
  assert.ok(frontend && backend, 'runtime join must retain real frontend/backend evidence')
  assert.equal(frontend.source.line, 11, 'real Vitest shared definition line')
  assert.equal(backend.source.line, 26, 'real xUnit shared definition line')
  assert.equal(frontend.navigationSource, undefined, 'do not guess row from buildCases() implementation')
  assert.equal(backend.navigationSource, undefined, 'do not guess row from MemberData provider Label initializer')
  assert.equal(frontend.expectedBehavior, 'user_stays_on_login_form_and_sees_an_error')
  assert.equal(backend.expectedBehavior, 'authentication_fails_and_user_stays_unauthenticated')
  assert.ok(frontend.assertions.some(a => a.sourceCode.includes('expect(authState.isAuthenticated).toBe(false)')))
  assert.ok(backend.assertions.some(a => a.sourceCode.includes('Assert.False(testCase.Authenticated);')))
}
const rendered = renderProjection(result.joined, {
  sourceHref: source => `nav:${source.line}`,
})
const dynamicActions = rendered.sourceActions.filter(a =>
  /login\.feature\.test\.ts|LoginFeatureTests\.cs/.test(a.source.file) && [11,26].includes(a.source.line))
assert.equal(dynamicActions.length, 4, 'two dynamic Situations with two definition-level actions each')
assert.deepEqual(dynamicActions.map(a => [a.role,a.source.line]), [
  ['frontend',11],['backend',26],['frontend',11],['backend',26],
])
const tree = buildTestingTree(result.joined,result.definitions,result.diagnostics)
const nodes = tree.flatMap(f=>f.children.flatMap(o=>o.children))
for(const scenario of nodes.filter(s=>expected.includes(s.label))) {
  assert.deepEqual(scenario.children.map(p=>[p.role,p.source.line]),
    [['frontend',11],['backend',26]], 'Testing API must preserve definition fallback')
}
for(const test of result.cases) {
  if(!expected.includes(test.situationId)) continue
  assert.ok(test.frameworkCaseId,'identity must come from actual framework materialization')
}
console.log('DYNAMIC_PROVIDER_SAFE_FALLBACK_PASS providers=2 concrete_cases=4 joined=3 dynamic_situations=2 exact_row_claims=0 definition_actions=4')
