// D-068 source-only proof; detects known input drift, never enables reuse.
import assert from 'node:assert/strict'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const {readPrototypeConfig}=require('../dist/core/config.js')
const {observeRefreshInputs,compareObservedRefreshInputs}=
  require('../dist/core/refreshInputProbe.js')
const workspace=path.join(root,'fixtures')
const config=readPrototypeConfig(path.join(workspace,'feature-projection.config.json'))
const options={workspaceRoot:workspace,config,trusted:true,dirtyDocumentPaths:[]}
const first=observeRefreshInputs(options),second=observeRefreshInputs(options)
assert.equal(first.reusePermitted,false)
assert.equal(second.reusePermitted,false)
assert.equal(first.scopes.length,2)
assert.ok(first.scopes.every(scope=>scope.status==='observed'&&scope.fileCount>0))
assert.ok(first.scopes.every(scope=>scope.fingerprint===
  second.scopes.find(other=>other.featureSpaceId===scope.featureSpaceId &&
    other.sourceId===scope.sourceId)?.fingerprint))
const compared=compareObservedRefreshInputs(first,second)
assert.equal(compared.reusePermitted,false)
assert.ok(compared.differences.every(scope=>scope.state==='observed-unchanged'))
const unavailable=observeRefreshInputs({...options,dirtyDocumentPaths:undefined})
assert.ok(compareObservedRefreshInputs(first,unavailable).differences.every(
  scope=>scope.state==='unverifiable'))
console.log('D068_KNOWN_INPUT_PROBE_PASS scopes=2 stable_observed_inputs=true'+
  ' dirty_editor_unknown_is_unverifiable=true source_mutations=false reuse_authorized=false')
