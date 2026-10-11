import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const {situationTestId}=require('../dist/core/testingTree.js')
const {planRunBoth,executeRunBoth}=require('../dist/core/runBothSituation.js')
function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'fp-p4-both-unit-'))
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}))
  const ui=path.join(root,'ui'),api=path.join(root,'api')
  const frontFile=path.join(ui,'src','login.feature.test.ts')
  const backFile=path.join(api,'Features','Login.cs')
  fs.mkdirSync(path.dirname(frontFile),{recursive:true})
  fs.mkdirSync(path.dirname(backFile),{recursive:true})
  fs.writeFileSync(frontFile,'// ui');fs.writeFileSync(backFile,'// backend')
  const s=file=>({file,line:10,column:1,start:0,end:20})
  const base={featureSpaceId:'app',logicalFolderKey:'.',featureName:'login',
    outcome:'expired',situation:'expired',expectedBehavior:'reject'}
  const front={...base,partRole:'frontend',source:s(frontFile),
    diagnostics:[],trust:'trusted'}
  const back={...base,partRole:'backend',source:s(backFile),
    diagnostics:[],trust:'trusted'}
  const row={...base,frontend:front,backend:back}
  const frontDef={...base,adapterId:'vitest-5',partRole:'frontend',
    frameworkProject:ui,isParameterized:false,source:s(frontFile),diagnostics:[],
    directSituation:'expired',definitionRef:{adapterId:'vitest-5',
      frameworkDefinitionKey:'login:10',frameworkProject:ui,
      sourceFile:frontFile,sourceLine:10}}
  const backDef={...base,adapterId:'xunit-v3',partRole:'backend',
    frameworkProject:api,isParameterized:false,source:s(backFile),diagnostics:[],
    directSituation:'expired',definitionRef:{adapterId:'xunit-v3',
      frameworkDefinitionKey:'LoginTests.login__expired__expired__reject()',
      frameworkProject:api,sourceFile:backFile,sourceLine:10}}
  const config={featureSpaces:[{id:'app',sources:[
    {id:'front',role:'frontend',adapter:'vitest-5',
      root:'ui/src',frameworkProject:'ui'},
    {id:'back',role:'backend',adapter:'xunit-v3',
      root:'api/Features',frameworkProject:'api',
      projectFile:'Api.Tests.csproj'},
  ]}]}
  return {row,frontDef,backDef,
    input:{workspaceRoot:root,config,joined:[row],
      definitions:[frontDef,backDef],cases:[],situationId:situationTestId(row),
      trusted:true,fresh:true,dirtyFilesKnownClean:true}}
}
test('P4 Run Both plans exact Frontend and Backend before execution',t=>{
  const f=fixture(t),plan=planRunBoth(f.input)
  assert.equal(plan.frontend.testName,'login__expired__expired__reject')
  assert.equal(plan.backend.fullName,'LoginTests.login__expired__expired__reject')
  assert.equal(plan.frontend.featureSpaceId,plan.backend.featureSpaceId)
})
test('P4 Run Both refuses partial, stale, dirty, untrusted or Theory Backend before Frontend',t=>{
  const f=fixture(t)
  const invalid=[
    {trusted:false},{fresh:false},{dirtyFilesKnownClean:false},
    {joined:[f.row,f.row]},{definitions:[f.frontDef]},
    {definitions:[f.frontDef,f.backDef,f.backDef]},
    {definitions:[f.frontDef,{...f.backDef,isParameterized:true}]},
    {joined:[{...f.row,backend:undefined}]},
    {joined:[{...f.row,frontend:undefined}]},
    {config:{featureSpaces:[]}},
  ]
  for(const update of invalid)
    assert.throws(()=>planRunBoth({...f.input,...update}))
})
const passed=name=>({status:'passed',executed:1,message:name,testName:name})
const failed=name=>({status:'failed',executed:1,message:name,testName:name})
const errored=name=>({status:'error',executed:0,message:name,testName:name})
test('P4 Run Both executes Frontend before Backend and returns both',async t=>{
  const plan=planRunBoth(fixture(t).input),calls=[]
  const result=await executeRunBoth(plan,{
    valid:()=>true,
    frontend:async()=>{calls.push('frontend');return passed('front')},
    backend:async()=>{calls.push('backend');return passed('back')},
  })
  assert.deepEqual(calls,['frontend','backend'])
  assert.equal(result.status,'passed')
  assert.equal(result.frontend.executed+result.backend.executed,2)
})
test('P4 Run Both executes Backend even after a genuine Frontend test failure',async t=>{
  const plan=planRunBoth(fixture(t).input),calls=[]
  const result=await executeRunBoth(plan,{
    valid:()=>true,
    frontend:async()=>{calls.push('frontend');return failed('front')},
    backend:async()=>{calls.push('backend');return passed('back')},
  })
  assert.deepEqual(calls,['frontend','backend'])
  assert.equal(result.status,'failed')
  assert.equal(result.backend.status,'passed')
})
test('P4 Run Both stops before Backend after Frontend error or drift',async t=>{
  const plan=planRunBoth(fixture(t).input)
  for(const first of [errored('front'),{...passed('front'),executed:2}]){
    let back=0
    const result=await executeRunBoth(plan,{
      valid:()=>true,frontend:async()=>first,
      backend:async()=>{back++;return passed('back')},
    })
    assert.equal(result.status,'error');assert.equal(back,0)
  }
  let checks=0,back=0
  const result=await executeRunBoth(plan,{
    valid:()=>++checks===1,frontend:async()=>passed('front'),
    backend:async()=>{back++;return passed('back')},
  })
  assert.equal(result.status,'error');assert.equal(back,0)
})
test('P4 Run Both refuses pre-run cancellation and false Backend evidence',async t=>{
  const plan=planRunBoth(fixture(t).input)
  let count=0
  const before=await executeRunBoth(plan,{
    valid:()=>false,
    frontend:async()=>{count++;return passed('front')},
    backend:async()=>{count++;return passed('back')},
  })
  assert.equal(before.status,'error');assert.equal(count,0)
  const second=await executeRunBoth(plan,{
    valid:()=>true,frontend:async()=>passed('front'),
    backend:async()=>({...passed('back'),executed:0}),
  })
  assert.equal(second.status,'error');assert.equal(second.backend.executed,0)
})
test('P4 Run Both preserves a real Backend failure alongside Frontend PASS',async t=>{
  const plan=planRunBoth(fixture(t).input),order=[]
  const result=await executeRunBoth(plan,{
    valid:()=>true,
    frontend:async()=>{order.push('frontend');return passed('front')},
    backend:async()=>{order.push('backend');return failed('back')},
  })
  assert.deepEqual(order,['frontend','backend'])
  assert.equal(result.status,'failed')
  assert.equal(result.frontend.status,'passed')
  assert.equal(result.backend.status,'failed')
})
test('P4 Run Both rejects state drift after Backend even if both tests passed',async t=>{
  const plan=planRunBoth(fixture(t).input)
  let count=0
  const result=await executeRunBoth(plan,{
    valid:()=>++count<5,
    frontend:async()=>passed('front'),
    backend:async()=>passed('back'),
  })
  assert.equal(result.status,'error')
  assert.equal(result.frontend.executed,1)
  assert.equal(result.backend.executed,1)
})
test('D-077 Run Both cancellation during Frontend prevents Backend',async t=>{
  const plan=planRunBoth(fixture(t).input)
  const abort=new AbortController()
  let backend=0
  const result=await executeRunBoth(plan,{
    valid:()=>!abort.signal.aborted,
    frontend:async()=>{abort.abort();return passed('front')},
    backend:async()=>{backend++;return passed('back')},
  })
  assert.equal(result.status,'error')
  assert.equal(backend,0)
  assert.equal(abort.signal.aborted,true)
})
test('D-077 Run Both cancellation during Backend prevents aggregate Passed',async t=>{
  const plan=planRunBoth(fixture(t).input)
  const abort=new AbortController(),calls=[]
  const result=await executeRunBoth(plan,{
    valid:()=>!abort.signal.aborted,
    frontend:async()=>{calls.push('front');return passed('front')},
    backend:async()=>{calls.push('back');abort.abort();return passed('back')},
  })
  assert.deepEqual(calls,['front','back'])
  assert.equal(result.status,'error')
})
// D-078: a native Theory identity must be proved before ANY Frontend test.
function theoryPlan(plan){
  return {...plan,backend:{...plan.backend,displayName:
    plan.backend.fullName+' [expired]',frameworkCaseId:'1'.repeat(64)}}
}
const validProof={ok:true,nativeCaseId:'2'.repeat(64),
  sourceDigest:'3'.repeat(64),projectDigest:'4'.repeat(64),
  assemblyDigest:'5'.repeat(64)}
test('D-078 exact Theory preflight precedes Frontend and proof reaches Backend',async t=>{
  const plan=theoryPlan(planRunBoth(fixture(t).input)),calls=[]
  const result=await executeRunBoth(plan,{
    valid:()=>true,
    preflightTheory:async target=>{
      calls.push('preflight:'+target.displayName);return validProof
    },
    frontend:async()=>{calls.push('frontend');return passed('frontend')},
    backend:async(_,proof)=>{
      calls.push('backend')
      assert.deepEqual(proof,validProof)
      return passed('backend')
    },
  })
  assert.equal(result.status,'passed')
  assert.deepEqual(calls,['preflight:'+plan.backend.displayName,'frontend','backend'])
})
test('D-078 missing/refused native Theory preflight starts zero tests',async t=>{
  const plan=theoryPlan(planRunBoth(fixture(t).input))
  for(const candidate of [undefined,async()=>({ok:false,message:'folded Theory'}),
    async()=>({ok:true,nativeCaseId:'2'.repeat(64)}),
    async()=>{throw Error('native discovery failed')} ]){
    let invoked=0
    const result=await executeRunBoth(plan,{
      valid:()=>true,preflightTheory:candidate,
      frontend:async()=>{invoked++;return passed('front')},
      backend:async()=>{invoked++;return passed('back')},
    })
    assert.equal(result.status,'error')
    assert.equal(invoked,0)
  }
})
test('D-078 cancellation during preflight prevents Frontend and Backend',async t=>{
  const plan=theoryPlan(planRunBoth(fixture(t).input))
  let fresh=true,invoked=0
  const result=await executeRunBoth(plan,{
    valid:()=>fresh,
    preflightTheory:async()=>{fresh=false;return validProof},
    frontend:async()=>{invoked++;return passed('front')},
    backend:async()=>{invoked++;return passed('back')},
  })
  assert.equal(result.status,'error')
  assert.equal(invoked,0)
})
