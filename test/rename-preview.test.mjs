import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {normalizeRenamePreview,renderRenamePreview}=require('../dist/core/renamePreview.js');

function fixture(t) {
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'fp-rename-preview-unit-'));
  const project=path.join(workspace,'backend');
  fs.mkdirSync(project);
  const file=path.join(project,'AccessFeatureTests.cs');
  fs.writeFileSync(file,'FeatureChecks.AssertDenied(false);\n');
  t.after(()=>fs.rmSync(workspace,{recursive:true,force:true}));
  const source=fs.readFileSync(file,'utf8');
  const start=source.indexOf('AssertDenied');
  const base={
    probeOnly:true,mutationSupported:false,projectScopeOnly:true,
    accepted:true,symbol:'FeatureChecks.AssertDenied(bool)',newName:'AssertAccessDenied',
    diagnostics:[],edits:[{file,start,end:start+'AssertDenied'.length,
      line:1,column:start+1,oldText:'AssertDenied',newText:'AssertAccessDenied'}],
  };
  const normalize=(data=base)=>normalizeRenamePreview(
    data,workspace,project,'FeatureChecks.AssertDenied(bool)','AssertAccessDenied');
  return {workspace,project,file,base,normalize};
}

test('validated scoped Rename Preview is never an editable patch',(t)=>{
  const f=fixture(t), result=f.normalize();
  assert.equal(result.probeOnly,true);
  assert.equal(result.mutationSupported,false);
  assert.equal(result.accepted,true);
  const rendered=renderRenamePreview(result,'billing','backend',f.project,s=>
    `vscode://file/${path.basename(s.file)}:${s.line}:${s.column}`);
  assert.match(rendered.markdown,/READ-ONLY RESEARCH PREVIEW/);
  assert.match(rendered.markdown,/No files are changed/);
  assert.match(rendered.markdown,/not an authorized cross-project rename plan/i);
  assert.match(rendered.markdown,/AssertDenied.*AssertAccessDenied/);
  assert.equal(rendered.actions.length,1);
  assert.match(rendered.markdown.split('\n')[rendered.actions[0].line],/^\- \[/);
  assert.ok(!Object.keys(result).includes('workspaceEdit'));
  assert.equal(fs.readFileSync(f.file,'utf8'),'FeatureChecks.AssertDenied(false);\n');
});

test('unsafe worker metadata, partial refusal and missing result are rejected',(t)=>{
  const f=fixture(t), clone=()=>structuredClone(f.base);
  for(const key of ['mutationSupported','probeOnly','projectScopeOnly']){
    const a=clone();a[key]=key==='mutationSupported';
    if(key!=='mutationSupported') a[key]=false;
    assert.throws(()=>f.normalize(a),/Invalid or mutating/);
  }
  {const a=clone();a.diagnostics=['warning'];
    assert.throws(()=>f.normalize(a),/partial or empty/);}
  {const a=clone();a.accepted=false;
    assert.throws(()=>f.normalize(a),/zero edits/);}
  {const a=clone();a.accepted=false;a.edits=[];a.diagnostics=['collision'];
    assert.equal(f.normalize(a).accepted,false);
    const rendered=renderRenamePreview(f.normalize(a),'billing','backend',f.project,()=>{throw Error('no links')});
    assert.equal(rendered.actions.length,0);
    assert.match(rendered.markdown,/REFUSED/);}
});

test('stale token, wrong source location and outside-project references fail closed',(t)=>{
  const f=fixture(t),clone=()=>structuredClone(f.base);
  {const a=clone();a.edits[0].start++;
    assert.throws(()=>f.normalize(a),/stale/);}
  {const a=clone();a.edits[0].line++;
    assert.throws(()=>f.normalize(a),/line\/column/);}
  {const a=clone();a.edits[0].column++;
    assert.throws(()=>f.normalize(a),/line\/column/);}
  {const a=clone();a.edits[0].newText='Malicious';
    assert.throws(()=>f.normalize(a),/token edit/);}
  {const a=clone();const foreign=path.join(f.workspace,'foreign.cs');
    fs.writeFileSync(foreign,'AssertDenied');
    a.edits[0].file=foreign;a.edits[0].start=0;a.edits[0].end=12;a.edits[0].column=1;
    assert.throws(()=>f.normalize(a),/escapes/);}
  {const a=clone();a.edits.push(structuredClone(a.edits[0]));
    assert.throws(()=>f.normalize(a),/Duplicate/);}
});

test('wrong selected identity and forbidden names fail closed',(t)=>{
  const f=fixture(t),clone=()=>structuredClone(f.base);
  {const a=clone();a.symbol='FeatureChecks.Other(bool)';
    assert.throws(()=>f.normalize(a),/Invalid or mutating/);}
  {const a=clone();a.newName='different';
    assert.throws(()=>f.normalize(a),/Invalid or mutating/);}
  {const a=clone();a.newName='rename; attack';
    assert.throws(()=>normalizeRenamePreview(a,f.workspace,f.project,
      a.symbol,a.newName),/Unacceptable/);}
});
