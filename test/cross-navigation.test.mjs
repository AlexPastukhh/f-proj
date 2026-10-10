import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { renderProjection } = require('../dist/core/projection.js')
const { buildTestingTree, situationTestId } = require('../dist/core/testingTree.js')

const source = (file, line) => ({file,start:0,end:1,line,column:1})
function scenario(space, role = 'backend') {
  const row = {
    featureSpaceId:space, logicalFolderKey:'shared', featureName:'access',
    outcome:'denied', situation:'expired',
  }
  const part = {
    ...row, partRole:role, expectedBehavior:'reauthentication_required',
    source:source(`/${space}.cs`,7), assertions:[], diagnostics:[],trust:'trusted',
  }
  return {...row, [role]:part}
}
test('cross-navigation shares complete semantic Situation ID across Projection and Test Explorer',()=>{
  const joined=[scenario('accounts'),scenario('billing')]
  const model=buildTestingTree(joined)
  const rendered=renderProjection(joined)
  assert.equal(rendered.situationActions.length,2)
  const ids=rendered.situationActions.map(a=>a.testId)
  assert.notEqual(ids[0],ids[1],'same label in different FeatureSpaces must remain distinct')
  assert.deepEqual(ids,joined.map(situationTestId))
  assert.deepEqual(ids,model.map(root=>root.children[0].children[0].id))
  const mdLines=rendered.markdown.split('\n')
  for(const action of rendered.situationActions){
    assert.equal(mdLines[action.line],'Situation: expired')
    assert.ok(action.line>0)
  }
})
test('cross-navigation preserves full source isolation even with repeated outcomes and logical folders',()=>{
  const one=scenario('accounts','frontend')
  const two=scenario('billing','backend')
  const rendered=renderProjection([one,two])
  assert.deepEqual(rendered.situationActions.map(a=>a.testId),[situationTestId(one),situationTestId(two)])
  assert.deepEqual(rendered.sourceActions.map(a=>a.role),['frontend','backend'])
  assert.equal(rendered.situationActions.length,2)
  assert.equal(rendered.sourceActions.length,2)
})
test('cross-navigation does not expose unresolved parameterized Situation as a concrete action',()=>{
  const def={
    id:'source-unresolved',featureSpaceId:'accounts',logicalFolderKey:'shared',
    featureName:'access',outcome:'denied',expectedBehavior:'reauthentication_required',
    isParameterized:true,partRole:'frontend',source:source('/missing.ts',11),
    definitionRef:{adapterId:'vitest-5',frameworkProject:'.',frameworkDefinitionKey:'f',sourceFile:'/missing.ts',sourceLine:11},
    assertions:[],diagnostics:[],
  }
  const rendered=renderProjection([])
  assert.deepEqual(rendered.situationActions,[])
  const nodes=buildTestingTree([], [def],[])
  assert.equal(nodes[0].children[0].children[0].kind,'unresolved')
  assert.ok(!rendered.markdown.includes('Situation: '))
})
