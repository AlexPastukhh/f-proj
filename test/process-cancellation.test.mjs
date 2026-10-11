import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const {runProcess,runJsonWorker}=require('../dist/core/process.js')
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
async function until(predicate,timeout=8000){
  const started=Date.now()
  while(Date.now()-started<timeout){
    if(predicate())return true
    await sleep(55)
  }
  return false
}
function exists(pid){
  try{process.kill(pid,0);return true}catch{return false}
}
test('D-077 pre-cancelled launch does not spawn CLI or JSON worker',async()=>{
  const c=new AbortController();c.abort()
  const p=await runProcess('definitely-nonexistent-command',[],os.tmpdir(),
    10000,{signal:c.signal})
  const j=await runJsonWorker('definitely-nonexistent-command',[],{},
    os.tmpdir(),10000,{signal:c.signal})
  assert.equal(p.cancelled,true);assert.equal(j.cancelled,true)
  assert.equal(p.ok,false);assert.equal(j.ok,false)
})
test('D-077 abort kills a running CLI process and its Windows child',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fp-p4-cancel-tree-'))
  const marker=path.join(dir,'pids.json')
  const grandFile=path.join(dir,'grandchild.js')
  const parentFile=path.join(dir,'parent.js')
  let pids
  t.after(()=>{
    if(pids&&process.platform==='win32'){
      for(const pid of [pids.parent,pids.child]){
        if(exists(pid))spawnSync('taskkill',['/PID',String(pid),'/T','/F'],{
          windowsHide:true,stdio:'ignore',timeout:3000})
      }
    }
    fs.rmSync(dir,{recursive:true,force:true})
  })
  fs.writeFileSync(grandFile,'setInterval(()=>{},1000)')
  fs.writeFileSync(parentFile,`
const fs=require('node:fs')
const {spawn}=require('node:child_process')
const g=spawn(process.execPath,[process.argv[3]],{stdio:'ignore'})
fs.writeFileSync(process.argv[2],JSON.stringify({parent:process.pid,child:g.pid}))
setInterval(()=>{},1000)
`)
  const abort=new AbortController()
  const run=runProcess(process.execPath,[parentFile,marker,grandFile],
    dir,25000,{signal:abort.signal,label:'p4-tree-abort'})
  assert.equal(await until(()=>fs.existsSync(marker)),true,'child process did not launch')
  pids=JSON.parse(fs.readFileSync(marker,'utf8'))
  assert.equal(exists(pids.parent),true);assert.equal(exists(pids.child),true)
  abort.abort()
  const result=await run
  assert.equal(result.cancelled,true)
  assert.equal(result.ok,false)
  assert.equal(await until(()=>!exists(pids.parent)&&!exists(pids.child),7500),
    true,'cancel must terminate parent AND its spawned child')
})
test('D-077 abort interrupts a JSON materializer without accepting evidence',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fp-p4-cancel-worker-'))
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}))
  const script=path.join(dir,'worker.js'),ready=path.join(dir,'ready')
  fs.writeFileSync(script,`
const fs=require('node:fs')
process.stdin.on('data',()=>{})
process.stdin.on('end',()=>{
  fs.writeFileSync(process.argv[2],'ready')
  setInterval(()=>{},1000)
})
`)
  const abort=new AbortController()
  const run=runJsonWorker(process.execPath,[script,ready],{id:'test'},
    dir,25000,{signal:abort.signal,label:'p4-worker-abort'})
  assert.equal(await until(()=>fs.existsSync(ready)),true)
  abort.abort()
  const result=await run
  assert.equal(result.cancelled,true)
  assert.equal(result.ok,false)
  assert.equal(result.value,undefined)
})
