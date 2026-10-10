import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { analyzeVitestSource } = require('../dist/adapters/vitestSource.js')
const { expandDefinitions, joinParts, renderMarkdown } = require('../dist/core/projection.js')
const { parseDescription, parseSituationId } = require('../dist/core/naming.js')

const root = path.resolve('fixtures')
const source = { id:'frontend', role:'frontend', root:'workspace/frontend/src/features', adapter:'vitest-5', frameworkProject:'workspace/frontend' }

test('parses four-part and parameterized descriptions', () => {
  assert.equal(parseDescription('login__session_expired__refresh_token_expired__screen_is_shown', false).situation, 'refresh_token_expired')
  assert.equal(parseDescription('login__invalid_user_input__error_is_shown [situation:$caseId]', true).expectedBehavior, 'error_is_shown')
  assert.equal(parseSituationId('Card Blocked').diagnostic.ruleId, 'feature-test/invalid-situation-id')
})

test('Vitest source adapter extracts literal assertions and source definitions', () => {
  const defs = analyzeVitestSource(source, 'app', root)
  assert.equal(defs.length, 2)
  const parameterized = defs.find(d => d.isParameterized)
  assert.ok(parameterized)
  assert.equal(parameterized.featureName, 'login')
  assert.equal(parameterized.assertions.length, 1)
  assert.match(parameterized.assertions[0].sourceCode, /expect\(authState\.isAuthenticated\)\.toBe\(false\)/)
  assert.equal(parameterized.logicalFolderKey, 'login')
})

test('joins frontend/backend only on exact Situation', () => {
  const defs = analyzeVitestSource(source, 'app', root)
  const frontendParam = defs.find(d => d.isParameterized)
  const frontendFact = defs.find(d => !d.isParameterized)
  const backend = JSON.parse(fs.readFileSync(path.resolve('fixtures/mock/dotnet-analysis.json'),'utf8')).definitions
  const cases = [
    { definitionRef:frontendParam.definitionRef, frameworkCaseId:'v1', situationId:'passwords_dont_match', diagnostics:[] },
    { definitionRef:frontendParam.definitionRef, frameworkCaseId:'v2', situationId:'email_has_invalid_format', diagnostics:[] },
    { definitionRef:backend[0].definitionRef, frameworkCaseId:'x1', situationId:'passwords_dont_match', diagnostics:[] },
    { definitionRef:backend[0].definitionRef, frameworkCaseId:'x2', situationId:'email_has_invalid_format', diagnostics:[] },
  ]
  const expanded = expandDefinitions([...defs, ...backend], cases)
  const joined = joinParts(expanded.parts)
  assert.equal(joined.length, 3)
  const password = joined.find(x => x.situation === 'passwords_dont_match')
  assert.ok(password.frontend && password.backend)
  const session = joined.find(x => x.situation === 'refresh_token_expired')
  assert.ok(session.frontend && session.backend)
  assert.match(renderMarkdown(joined), /Situation: passwords_dont_match/)
})

test('duplicate Situation is diagnosed within one scope/role', () => {
  const defs = analyzeVitestSource(source, 'app', root)
  const d = defs.find(x => x.isParameterized)
  const cloned = { ...d, id:d.id+'-clone', definitionRef:{...d.definitionRef, frameworkDefinitionKey:d.definitionRef.frameworkDefinitionKey+'x'} }
  const cases = [
    { definitionRef:d.definitionRef, frameworkCaseId:'a', situationId:'same_case', diagnostics:[] },
    { definitionRef:cloned.definitionRef, frameworkCaseId:'b', situationId:'same_case', diagnostics:[] },
  ]
  const out = expandDefinitions([d, cloned], cases)
  const duplicate = out.diagnostics.find(x => x.ruleId === 'feature-test/unique-situation')
  assert.ok(duplicate)
  assert.equal(duplicate.category, 'projection-safety')
  assert.equal(duplicate.severity, 'error')
  assert.equal(duplicate.projectionImpact, 'blocks-part')
  assert.equal(out.parts.length, 0, 'ambiguous duplicate must not retain an arbitrary trusted part')
  assert.equal(joinParts(out.parts).length, 0, 'ambiguous duplicate must not create a complete Situation')
})

test('Situation may repeat across different Features and Outcomes inside one scope', () => {
  const [base] = analyzeVitestSource(source, 'app', root).filter(x => x.isParameterized)
  const variants = [
    { featureName:'login', outcome:'invalid_user_input' },
    { featureName:'login', outcome:'session_expired' },
    { featureName:'profile', outcome:'invalid_user_input' },
  ]
  const defs = variants.map((variant, i) => ({
    ...base, ...variant, id:`variant-${i}`,
    definitionRef:{...base.definitionRef, frameworkDefinitionKey:`variant-${i}`},
  }))
  const cases = defs.map((d, i) => ({
    definitionRef:d.definitionRef, frameworkCaseId:`case-${i}`, situationId:'same_case', diagnostics:[],
  }))
  const out = expandDefinitions(defs, cases)
  assert.equal(out.diagnostics.filter(x => x.ruleId === 'feature-test/unique-situation').length, 0)
  assert.equal(out.parts.length, 3)
  assert.equal(joinParts(out.parts).length, 3)
})

test('missing and non-canonical parameterized Situation identities cannot project', () => {
  const definition = analyzeVitestSource(source, 'app', root).find(x => x.isParameterized)
  for (const [label, situationId, expectedRule] of [
    ['missing', undefined, 'feature-test/missing-situation-id'],
    ['non-canonical', 'Card Blocked', 'feature-test/invalid-situation-id'],
  ]) {
    const cases = [{ definitionRef:definition.definitionRef, frameworkCaseId:label, situationId, diagnostics:[] }]
    const expanded = expandDefinitions([definition], cases)
    const diagnostic = expanded.diagnostics.find(x => x.ruleId === expectedRule)
    assert.ok(diagnostic, label)
    assert.equal(diagnostic.category, 'projection-safety', label)
    assert.equal(diagnostic.severity, 'error', label)
    assert.equal(diagnostic.projectionImpact, 'blocks-part', label)
    assert.equal(expanded.parts.length, 0, label)
    assert.equal(joinParts(expanded.parts).length, 0, label)
  }
})

test('malformed canonical feature name blocks projection', () => {
  const parsed = parseDescription('Login__session_expired__refresh_token_expired__screen_is_shown', false)
  const template = analyzeVitestSource(source, 'app', root).find(x => !x.isParameterized)
  const definition = {
    ...template, isParameterized:false,
    featureName:parsed.featureName, outcome:parsed.outcome,
    directSituation:parsed.situation, expectedBehavior:parsed.expectedBehavior,
    diagnostics:parsed.diagnostics,
  }
  const expanded = expandDefinitions([definition], [])
  const diagnostic = expanded.diagnostics.find(x => x.ruleId === 'feature-test/canonical-name')
  assert.ok(diagnostic)
  assert.equal(diagnostic.category, 'projection-safety')
  assert.equal(diagnostic.severity, 'error')
  assert.equal(diagnostic.projectionImpact, 'blocks-part')
  assert.equal(expanded.parts.length, 0)
  assert.equal(joinParts(expanded.parts).length, 0)
})

test('wrong FeatureScope never joins frontend and backend evidence', () => {
  const frontend = analyzeVitestSource(source, 'app', root).find(x => !x.isParameterized)
  for (const [label, scopePatch] of [
    ['FeatureSpaceId', {featureSpaceId:'other_space'}],
    ['logicalFolderKey', {logicalFolderKey:'other_folder'}],
  ]) {
    const backend = {...frontend, ...scopePatch, id:`backend-${label}`, partRole:'backend'}
    const expanded = expandDefinitions([frontend, backend], [])
    const joined = joinParts(expanded.parts)
    assert.equal(expanded.diagnostics.filter(d => d.projectionImpact === 'blocks-part').length, 0, label)
    assert.equal(joined.length, 2, label)
    assert.equal(joined.filter(s => s.frontend && s.backend).length, 0, label)
    assert.equal(joined.filter(s => s.frontend && !s.backend).length, 1, label)
    assert.equal(joined.filter(s => !s.frontend && s.backend).length, 1, label)
  }
})

test('concrete navigation anchors do not create Situation identity or guess ambiguous rows', () => {
  const staticSource = {
    id:'frontend', role:'frontend', adapter:'vitest-5',
    root:'fixtures/parameterized-navigation-proof/frontend/src/features',
    frameworkProject:'fixtures/parameterized-navigation-proof/frontend'
  }
  const [definition] = analyzeVitestSource(staticSource, 'app', process.cwd())
  assert.ok(definition)
  assert.equal(definition.source.line,3)
  assert.deepEqual(definition.caseSourceAnchors.map(a=>[a.label,a.source.line]),[['expired',4],['locked',5]])
  const mkCase = situationId => ({
    definitionRef:definition.definitionRef,
    frameworkCaseId:`case-${situationId}`,
    situationId, diagnostics:[],
  })
  const before = expandDefinitions([definition],[])
  assert.equal(before.parts.length,0,'static source rows must not synthesize framework concrete cases')
  const exact = expandDefinitions([definition],[mkCase('locked')])
  assert.equal(exact.parts.length,1)
  assert.equal(exact.parts[0].situation,'locked')
  assert.equal(exact.parts[0].source.line,3)
  assert.equal(exact.parts[0].navigationSource.line,5)
  const other = expandDefinitions([definition],[mkCase('runtime_only')])
  assert.equal(other.parts.length,1)
  assert.equal(other.parts[0].navigationSource,undefined,'unmatched framework label navigates to definition')
  const ambiguous = {...definition,caseSourceAnchors:[definition.caseSourceAnchors[0],definition.caseSourceAnchors[0]]}
  const duplicate = expandDefinitions([ambiguous],[mkCase('expired')])
  assert.equal(duplicate.parts.length,1)
  assert.equal(duplicate.parts[0].navigationSource,undefined,'duplicated source anchors must not pick a row')
})

test('concrete-case correlation is isolated by framework project identity', () => {
  const base = {
    logicalFolderKey:'shared', partRole:'frontend', adapterId:'vitest-5', isParameterized:true,
    featureName:'access', outcome:'denied', expectedBehavior:'blocked', assertions:[], diagnostics:[],
    source:{file:'same.feature.test.ts',start:0,end:1,line:11,column:1},
  }
  const accounts = {
    ...base, id:'accounts', featureSpaceId:'accounts', frameworkProject:'C:/repo/apps/account-web',
    definitionRef:{adapterId:'vitest-5',frameworkProject:'C:/repo/apps/account-web',frameworkDefinitionKey:'spec/shared/access.feature.test.ts:11:1',sourceFile:'C:/repo/apps/account-web/spec/shared/access.feature.test.ts',sourceLine:11},
  }
  const billing = {
    ...base, id:'billing', featureSpaceId:'billing', frameworkProject:'C:/repo/apps/billing-web',
    definitionRef:{adapterId:'vitest-5',frameworkProject:'C:/repo/apps/billing-web',frameworkDefinitionKey:'spec/shared/access.feature.test.ts:11:1',sourceFile:'C:/repo/apps/billing-web/spec/shared/access.feature.test.ts',sourceLine:11},
  }
  const cases = [
    { definitionRef:accounts.definitionRef, frameworkCaseId:'a', situationId:'expired', diagnostics:[] },
    { definitionRef:billing.definitionRef, frameworkCaseId:'b', situationId:'expired', diagnostics:[] },
  ]
  const out = expandDefinitions([accounts,billing], cases)
  assert.equal(out.parts.length, 2)
  assert.equal(out.diagnostics.filter(x => x.ruleId === 'feature-test/unique-situation').length, 0)
})
