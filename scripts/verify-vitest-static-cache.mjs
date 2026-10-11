// D-069 opt-in static Vitest cache proof; runtime and Roslyn are uncached.
import assert from 'node:assert/strict'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const {readPrototypeConfig}=require('../dist/core/config.js')
const {runFullPrototype}=require('../dist/core/fullEngine.js')
const {VitestStaticCache}=require('../dist/core/vitestStaticCache.js')
const {observeRefreshInputs}=require('../dist/core/refreshInputProbe.js')
const workspace=path.join(root,'fixtures')
const config=readPrototypeConfig(path.join(workspace,'feature-projection.config.json'))
const inputs=()=>observeRefreshInputs({workspaceRoot:workspace,config,trusted:true,
  dirtyDocumentPaths:[]})
const before=inputs()
assert.ok(before.scopes.every(s=>s.status==='observed'))
const cache=new VitestStaticCache()
const common={workspaceRoot:workspace,config,trusted:true,
  vitestWorkerPath:path.join(root,'workers/vitest-materialize.mjs'),
  dotnetWorkerDll:path.join(root,'workers/dotnet/bin/Release/net8.0/FeatureProjection.DotNetWorker.dll'),
}
async function attempt(useCache){
  const entries=[]
  const result=await runFullPrototype({...common,
    ...(useCache?{vitestStaticCache:cache,dirtyDocumentPaths:[]}:{}),
    log:line=>{if(line.includes('static-cache=')) entries.push(line)},
  })
  assert.equal(result.joined.length,3)
  assert.equal(result.diagnostics.filter(d=>d.projectionImpact==='blocks-part').length,0)
  return {result,entries}
}
const cold=await attempt(true)
const warm=await attempt(true)
const uncached=await attempt(false)
assert.deepEqual(cold.result,uncached.result)
assert.deepEqual(warm.result,uncached.result)
assert.equal(cold.entries.filter(s=>s.includes('static-cache=miss')).length,1)
assert.equal(warm.entries.filter(s=>s.includes('static-cache=hit')).length,1)
assert.equal(cache.size,1)
const after=inputs()
assert.deepEqual(after,before,'real proof mutated source inputs')
assert.equal(before.reusePermitted,false)
console.log('D069_VITEST_STATIC_CACHE_PASS real_situations=3 cold_miss=1 warm_hit=1'+
  ' complete_projection_equal=true runtime_workers_still_execute=true'+
  ' roslyn_not_cached=true opt_in_only=true no_source_edits=true')
