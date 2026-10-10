import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { correlateVitestCases, materializeVitest, frameworkPathKey } = require('../dist/adapters/vitestMaterializer.js')
const { expandDefinitions, joinParts } = require('../dist/core/projection.js')


test('Vitest path correlation is case-insensitive on Windows paths', () => {
  assert.equal(
    frameworkPathKey('c:\\Users\\Example\\Repo\\feature.test.ts', 'win32'),
    frameworkPathKey('C:\\users\\example\\repo\\FEATURE.test.ts', 'win32'),
  )
})
function def({line, parameterized, key}) {
  const file = path.resolve('fixture.feature.test.ts')
  return {
    id:key, featureSpaceId:'app', logicalFolderKey:'login', partRole:'frontend', adapterId:'vitest-5', frameworkProject:'.',
    isParameterized:parameterized, featureName:'login', outcome:'o', directSituation:parameterized ? undefined : 'direct_case',
    expectedBehavior:'behavior', assertions:[],
    source:{file,start:0,end:1,line,column:1},
    definitionRef:{adapterId:'vitest-5',frameworkDefinitionKey:key,sourceFile:file,sourceLine:line}, diagnostics:[]
  }
}

test('Vitest materializer ignores collected ordinary four-part tests', () => {
  const ordinary = def({line:19, parameterized:false, key:'ordinary'})
  const out = correlateVitestCases([{
    frameworkCaseId:'v-fact', moduleId:ordinary.source.file, sourceLine:19, sourceColumn:1,
    displayName:'login__session_expired__refresh_token_expired__screen_is_shown'
  }], [ordinary])
  assert.deepEqual(out.cases, [])
  assert.deepEqual(out.diagnostics, [])
})

test('Vitest materializer correlates parameterized cases and preserves explicit Situation', () => {
  const parameterized = def({line:11, parameterized:true, key:'parameterized'})
  const out = correlateVitestCases([{
    frameworkCaseId:'v-row', moduleId:parameterized.source.file, sourceLine:11, sourceColumn:1,
    situationId:'passwords_dont_match', displayName:'x [situation:passwords_dont_match]'
  }], [parameterized])
  assert.equal(out.diagnostics.length, 0)
  assert.equal(out.cases.length, 1)
  assert.equal(out.cases[0].situationId, 'passwords_dont_match')
})


test('Vitest multiline each correlates using framework task location, not source expression start', () => {
  const definition = def({line:3, parameterized:true, key:'multiline-each'})
  definition.definitionRef.frameworkTaskLine = 6
  definition.definitionRef.frameworkTaskColumn = 3
  const collected = [{
    frameworkCaseId:'real-row', moduleId:definition.source.file,
    sourceLine:6, sourceColumn:3, situationId:'expired', displayName:'[situation:expired]',
  }]
  const out = correlateVitestCases(collected, [definition])
  assert.equal(out.diagnostics.length,0)
  assert.equal(out.cases.length,1)
  assert.equal(out.cases[0].situationId,'expired')

  for(const [line,column] of [[3,1],[6,4]]) {
    const wrong = correlateVitestCases([{...collected[0],sourceLine:line,sourceColumn:column}], [definition])
    assert.equal(wrong.cases.length,0)
    assert.equal(wrong.diagnostics[0].ruleId,'feature-test/unresolved-test-definition')
  }
})

test('unresolved TestDefinition correlation blocks orphan Vitest case evidence', () => {
  const first = def({line:11, parameterized:true, key:'first'})
  const second = def({line:11, parameterized:true, key:'second'})
  const out = correlateVitestCases([{
    frameworkCaseId:'ambiguous', moduleId:first.source.file, sourceLine:11, sourceColumn:1,
    situationId:'happy_path', displayName:'unresolved-case',
  }], [first, second])
  assert.equal(out.cases.length, 0)
  assert.equal(out.diagnostics.length, 1)
  assert.equal(out.diagnostics[0].ruleId, 'feature-test/unresolved-test-definition')
  assert.equal(out.diagnostics[0].category, 'projection-safety')
  assert.equal(out.diagnostics[0].severity, 'error')
  assert.equal(out.diagnostics[0].projectionImpact, 'blocks-part')
  const expanded = expandDefinitions([first, second], out.cases)
  assert.equal(expanded.parts.length, 0)
  assert.equal(joinParts(expanded.parts).length, 0)
})

test('Vitest materialization failure diagnostic includes stdout when stderr is empty', async () => {
  const worker = path.resolve('fixtures/mock/fail-stdout-worker.mjs')
  const source = { id:'frontend', role:'frontend', root:'.', adapter:'vitest-5', frameworkProject:'.' }
  const out = await materializeVitest(source, [], process.cwd(), worker, 3000, { command:process.execPath })
  assert.equal(out.cases.length, 0)
  assert.equal(out.diagnostics.length, 1)
  assert.match(out.diagnostics[0].message, /stdout/)
  assert.match(out.diagnostics[0].message, /synthetic worker stdout failure detail/)
})


test('timed-out Vitest materialization blocks parameterized evidence explicitly', async () => {
  const worker = path.resolve('fixtures/mock/hang-worker.mjs')
  const source = { id:'frontend', role:'frontend', root:'.', adapter:'vitest-5', frameworkProject:'.' }
  const parameterized = def({line:11, parameterized:true, key:'timeout-definition'})
  const out = await materializeVitest(source, [parameterized], process.cwd(), worker, 150, { command:process.execPath })
  assert.equal(out.cases.length, 0)
  assert.equal(out.diagnostics.length, 1)
  const diagnostic = out.diagnostics[0]
  assert.equal(diagnostic.ruleId, 'worker/materialization-timeout')
  assert.equal(diagnostic.category, 'runtime')
  assert.equal(diagnostic.severity, 'error')
  assert.equal(diagnostic.projectionImpact, 'blocks-part')
  const expanded = expandDefinitions([parameterized], out.cases)
  assert.equal(expanded.parts.length, 0)
  assert.equal(joinParts(expanded.parts).length, 0)
})

test('Vitest materializer forwards optional configFile resolved from frameworkProject', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'feature-projection-vitest-config-'))
  const project = path.join(root, 'frontend')
  fs.mkdirSync(path.join(project, 'features'), {recursive:true})
  const configPath = path.join(project, 'vitest.custom.ts')
  fs.writeFileSync(configPath, 'export default {}', 'utf8')
  const worker = path.join(root, 'capture-worker.mjs')
  fs.writeFileSync(worker, `import fs from 'node:fs'; const input=JSON.parse(fs.readFileSync(0,'utf8')); process.stdout.write(JSON.stringify({cases:[],diagnostics:[{message:'configFile='+input.configFile}]}));`, 'utf8')
  const source = { id:'frontend', role:'frontend', root:'frontend/features', adapter:'vitest-5', frameworkProject:'frontend', configFile:'vitest.custom.ts' }
  const out = await materializeVitest(source, [], root, worker, 3000, { command:process.execPath })
  assert.equal(out.diagnostics.length, 1)
  assert.equal(out.diagnostics[0].ruleId, 'worker/vitest-collection-error')
  assert.match(out.diagnostics[0].message, /configFile=/)
  assert.ok(out.diagnostics[0].message.toLowerCase().includes(fs.realpathSync.native(configPath).toLowerCase()))
})


test('Vitest correlation resolves existing symlink/junction path identity', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'feature-projection-link-path-'))
  const realDir = path.join(root, 'real')
  const linkedDir = path.join(root, 'linked')
  fs.mkdirSync(realDir, {recursive:true})
  const realFile = path.join(realDir, 'feature.test.ts')
  fs.writeFileSync(realFile, '// fixture', 'utf8')
  fs.symlinkSync(realDir, linkedDir, process.platform === 'win32' ? 'junction' : 'dir')
  const linkedFile = path.join(linkedDir, 'feature.test.ts')

  const parameterized = def({line:11, parameterized:true, key:'linked-parameterized'})
  parameterized.source.file = linkedFile
  parameterized.definitionRef.sourceFile = linkedFile
  const out = correlateVitestCases([{
    frameworkCaseId:'linked-row', moduleId:realFile, sourceLine:11, sourceColumn:1,
    situationId:'passwords_dont_match', displayName:'x [situation:passwords_dont_match]'
  }], [parameterized])
  assert.equal(out.diagnostics.length, 0)
  assert.equal(out.cases.length, 1)
  assert.equal(out.cases[0].situationId, 'passwords_dont_match')
})
