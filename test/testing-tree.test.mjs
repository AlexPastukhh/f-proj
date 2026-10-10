import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { buildTestingTree } = require('../dist/core/testingTree.js')

test('Testing API tree maps feature/outcome/situation/parts without changing semantics', () => {
  const source = (file, line) => ({ file, start:0, end:1, line, column:1 })
  const joined = [
    {
      featureSpaceId:'app', logicalFolderKey:'login', featureName:'login', outcome:'invalid_user_input', situation:'passwords_dont_match',
      frontend:{ featureSpaceId:'app', logicalFolderKey:'login', featureName:'login', outcome:'invalid_user_input', situation:'passwords_dont_match', partRole:'frontend', expectedBehavior:'error_is_shown', assertions:[], source:source('/front.ts',10), diagnostics:[], trust:'trusted' },
      backend:{ featureSpaceId:'app', logicalFolderKey:'login', featureName:'login', outcome:'invalid_user_input', situation:'passwords_dont_match', partRole:'backend', expectedBehavior:'authentication_fails', assertions:[], source:source('/back.cs',20), diagnostics:[], trust:'trusted' },
    }
  ]
  const roots = buildTestingTree(joined)
  assert.equal(roots.length, 1)
  assert.equal(roots[0].label, 'login · app/login')
  const outcome = roots[0].children[0]
  assert.equal(outcome.label, 'invalid_user_input')
  const situation = outcome.children[0]
  assert.equal(situation.label, 'passwords_dont_match')
  assert.deepEqual(situation.children.map(x => x.role), ['frontend','backend'])
  const frontend = situation.children.find(x => x.role === 'frontend')
  const backend = situation.children.find(x => x.role === 'backend')
  assert.equal(frontend.label, 'Frontend')
  assert.equal(frontend.description, 'error_is_shown')
  assert.equal(backend.label, 'Backend')
  assert.equal(backend.description, 'authentication_fails')
  assert.equal(backend.source.file, '/back.cs')
})

test('Testing API tree makes an unmatched part visible instead of silently omitting it', () => {
  const source = { file:'/front.ts', start:0, end:1, line:10, column:1 }
  const joined = [{
    featureSpaceId:'app', logicalFolderKey:'login', featureName:'login', outcome:'session_expired', situation:'refresh_token_expired',
    frontend:{ featureSpaceId:'app', logicalFolderKey:'login', featureName:'login', outcome:'session_expired', situation:'refresh_token_expired', partRole:'frontend', expectedBehavior:'reauthentication_screen_is_shown', assertions:[], source, diagnostics:[], trust:'trusted' },
  }]
  const situation = buildTestingTree(joined)[0].children[0].children[0]
  const backend = situation.children.find(x => x.role === 'backend')
  assert.equal(backend.label, 'Backend')
  assert.equal(backend.description, 'unmatched')
  assert.equal(backend.missing, true)
  assert.equal(backend.source, undefined)
})

test('Testing API tree keeps unresolved parameterized definitions visible', () => {
  const source = { file:'/front.ts', start:0, end:1, line:11, column:1 }
  const definition = {
    id:'frontend:param', featureSpaceId:'app', logicalFolderKey:'login', partRole:'frontend', adapterId:'vitest-5', frameworkProject:'/front',
    isParameterized:true, featureName:'login', outcome:'invalid_user_input', expectedBehavior:'error_is_shown', assertions:[], source,
    definitionRef:{adapterId:'vitest-5',frameworkDefinitionKey:'x',sourceFile:'/front.ts',sourceLine:11}, diagnostics:[]
  }
  const diagnostics = [{
    ruleId:'feature-test/resolvable-situation', category:'projection-safety', severity:'warning', projectionImpact:'blocks-part',
    message:'Parameterized test requires framework materialization', source,
  }]
  const roots = buildTestingTree([], [definition], diagnostics)
  const outcome = roots[0].children[0]
  const unresolved = outcome.children.find(x => x.kind === 'unresolved')
  assert.ok(unresolved)
  assert.equal(unresolved.label, '[situations unresolved]')
  assert.equal(unresolved.children[0].role, 'frontend')
  assert.match(unresolved.children[0].description, /unresolved/)
  assert.match(unresolved.children[0].error, /requires framework materialization/)
})
