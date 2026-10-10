import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { normalizeDotnetDefinitions } = require('../dist/adapters/dotnetClient.js')

test('normalizes Roslyn worker raw method names into semantic test definitions', () => {
  const [d] = normalizeDotnetDefinitions([{
    id:'1',featureSpaceId:'app',logicalFolderKey:'login',partRole:'backend',adapterId:'xunit-v3',frameworkProject:'/p',isParameterized:false,
    rawDescription:'login__session_expired__refresh_token_expired__request_is_rejected',assertions:[],source:{file:'x.cs',start:0,end:1,line:1,column:1},definitionRef:{adapterId:'xunit-v3',frameworkDefinitionKey:'M',sourceFile:'x.cs',sourceLine:1},diagnostics:[]
  }])
  assert.equal(d.featureName,'login')
  assert.equal(d.outcome,'session_expired')
  assert.equal(d.directSituation,'refresh_token_expired')
  assert.equal(d.expectedBehavior,'request_is_rejected')
})

test('normalizes incomplete .NET worker diagnostics to blocking runtime errors', () => {
  const [d] = normalizeDotnetDefinitions([{
    id:'2',featureSpaceId:'app',logicalFolderKey:'login',partRole:'backend',adapterId:'xunit-v3',frameworkProject:'/p',isParameterized:false,
    rawDescription:'login__session_expired__refresh_token_expired__request_is_rejected',assertions:[],source:{file:'x.cs',start:0,end:1,line:1,column:1},definitionRef:{adapterId:'xunit-v3',frameworkDefinitionKey:'M',sourceFile:'x.cs',sourceLine:1},
    diagnostics:[{ruleId:'worker/legacy-diagnostic',message:'legacy worker shape'}]
  }])
  const diag = d.diagnostics.find(x => x.ruleId === 'worker/legacy-diagnostic')
  assert.equal(diag.category, 'runtime')
  assert.equal(diag.severity, 'error')
  assert.equal(diag.projectionImpact, 'blocks-part')
})
