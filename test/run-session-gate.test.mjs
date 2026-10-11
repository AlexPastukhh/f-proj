import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const {RunSessionGate}=require('../dist/core/runSessionGate.js')
const {isPublishedRunSelection}=require('../dist/core/runSelectionGate.js')

test('D-079 serializes all P4 profiles and releases on completion',()=>{
  const gate=new RunSessionGate()
  const frontend=gate.acquire()
  assert.ok(frontend)
  assert.equal(gate.occupied,true)
  assert.equal(gate.acquire(),undefined)
  assert.equal(frontend.isCurrent(),true)
  frontend.release()
  assert.equal(gate.occupied,false)
  const backend=gate.acquire()
  assert.ok(backend)
  assert.equal(backend.isCurrent(),true)
  frontend.release()
  assert.equal(backend.isCurrent(),true,'old lease may not release current run')
  backend.release()
  assert.equal(gate.occupied,false)
})

test('D-079 stale/refresh invalidation aborts active child and rejects reuse',()=>{
  const gate=new RunSessionGate()
  const both=gate.acquire()
  let aborted=0
  both.signal.addEventListener('abort',()=>aborted++)
  gate.invalidate()
  gate.invalidate()
  assert.equal(aborted,1)
  assert.equal(both.signal.aborted,true)
  assert.equal(both.isCurrent(),false)
  assert.equal(gate.acquire(),undefined,'revoked lease is held until the runner settles')
  both.release()
  const next=gate.acquire()
  assert.ok(next)
  assert.equal(next.signal.aborted,false)
  assert.equal(next.isCurrent(),true)
  both.release()
  assert.equal(next.isCurrent(),true)
  next.release()
})

test('D-079 published TestItem object identity rejects recycled and forged IDs',()=>{
  const selected={id:'scope/login/expired/frontend'}
  const backend={id:'scope/login/expired/backend'}
  const parent={id:'scope/login/expired',
    children:{get(id){
      if(id===selected.id)return selected
      if(id===backend.id)return backend
    }}}
  const items=new Map([[parent.id,parent]])
  assert.equal(isPublishedRunSelection(selected,'frontend',items),true)
  assert.equal(isPublishedRunSelection(backend,'backend',items),true)
  assert.equal(isPublishedRunSelection(parent,'both',items),true)
  assert.equal(isPublishedRunSelection({...selected},'frontend',items),false)
  assert.equal(isPublishedRunSelection({...backend},'backend',items),false)
  assert.equal(isPublishedRunSelection({...parent},'both',items),false)
  assert.equal(isPublishedRunSelection(parent,'frontend',items),false)
  assert.equal(isPublishedRunSelection(selected,'both',items),false)
  assert.equal(isPublishedRunSelection(undefined,'backend',items),false)
  const replacement={...parent,children:{get:()=>undefined}}
  const republished=new Map([[parent.id,replacement]])
  assert.equal(isPublishedRunSelection(parent,'both',republished),false)
  assert.equal(isPublishedRunSelection(selected,'frontend',republished),false)
})
