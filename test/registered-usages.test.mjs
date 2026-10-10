import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {normalizeRegisteredUsages,renderRegisteredUsages}=require('../dist/core/registeredUsages.js');

function setup(t){
 const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'feature-projection-usage-unit-'));
 const project=path.join(workspace,'backend');
 const feature=path.join(project,'Features');
 fs.mkdirSync(feature,{recursive:true});
 const registered=path.join(project,'FeatureProjectionConfig.cs');
 const testFile=path.join(feature,'AccessFeatureTests.cs');
 fs.writeFileSync(registered,'builder.RegisterAssertion(() => FeatureChecks.AssertDenied(default(bool)));\n');
 fs.writeFileSync(testFile,'FeatureChecks.AssertDenied(false);\n');
 t.after(()=>fs.rmSync(workspace,{force:true,recursive:true}));
 function loc(file,needle,kind){
   const src=fs.readFileSync(file,'utf8');
   const start=src.indexOf(needle);
   assert.ok(start>=0);
   return {kind,source:{file,start,end:start+needle.length,line:1,column:start+1}};
 }
 const data={probeOnly:true,mutationSupported:false,targets:[
  {kind:'assertion',symbol:'FeatureChecks.AssertDenied(bool)',references:[
   loc(registered,'AssertDenied','registration'),loc(testFile,'AssertDenied','feature-test')
  ]}],diagnostics:[]};
 return {workspace,project,feature,registered,testFile,data};
}

test('register usage links are strictly scoped and rendered read-only with code-lens anchors',(t)=>{
 const x=setup(t);
 const result=normalizeRegisteredUsages(x.data,x.workspace,x.project);
 assert.equal(result.targets.length,1);
 const rendered=renderRegisteredUsages(result,'app','backend',x.project,s=>`vscode://file/${path.basename(s.file)}:${s.line}:${s.column}`);
 assert.equal(rendered.actions.length,2);
 assert.match(rendered.markdown,/Read-only/);
 assert.match(rendered.markdown,/FeatureSpace: `app`/);
 assert.match(rendered.markdown,/FeatureChecks\.AssertDenied\(bool\)/);
 assert.match(rendered.markdown,/Registration/);
 assert.match(rendered.markdown,/Feature test/);
 for(const a of rendered.actions) assert.match(rendered.markdown.split('\n')[a.line],/^- \[/);
});

test('ambiguous usage result refuses partial references',(t)=>{
 const x=setup(t);
 const partial={...x.data,diagnostics:['Duplicate registration']};
 assert.throws(()=>normalizeRegisteredUsages(partial,x.workspace,x.project),/partial/);
 const failClosed={...partial,targets:[]};
 const normalized=normalizeRegisteredUsages(failClosed,x.workspace,x.project);
 const rendered=renderRegisteredUsages(normalized,'app','backend',x.project,()=>{throw Error('should not render a link')});
 assert.equal(rendered.actions.length,0);
 assert.match(rendered.markdown,/No partial usage results/);
});

test('registered symbol identity, span drift and project ancestry fail closed',(t)=>{
 const x=setup(t);
 const clone=()=>structuredClone(x.data);
 {const a=clone();a.targets[0].symbol='FeatureChecks.OtherMethod(bool)';
  assert.throws(()=>normalizeRegisteredUsages(a,x.workspace,x.project),/symbol span/);}
 {const a=clone();a.targets[0].references[1].source.start++;
  assert.throws(()=>normalizeRegisteredUsages(a,x.workspace,x.project),/symbol span/);}
 {const a=clone();a.targets[0].references[1].source.column++;
  assert.throws(()=>normalizeRegisteredUsages(a,x.workspace,x.project),/line\/column/);}
 {const a=clone();a.targets[0].references[1].source.file=path.join(x.workspace,'wrong.cs');
  fs.writeFileSync(a.targets[0].references[1].source.file,'AssertDenied');
  assert.throws(()=>normalizeRegisteredUsages(a,x.workspace,x.project),/escapes/);}
 {const a=clone();a.targets[0].references=a.targets[0].references.filter(r=>r.kind!=='registration');
  assert.throws(()=>normalizeRegisteredUsages(a,x.workspace,x.project),/lacks its registration/);}
 {const a=clone();a.targets.push(structuredClone(a.targets[0]));
  assert.throws(()=>normalizeRegisteredUsages(a,x.workspace,x.project),/duplicate/);}
});

test('usage metadata never allows mutation claim',(t)=>{
 const x=setup(t);
 assert.throws(()=>normalizeRegisteredUsages({...x.data,mutationSupported:true},x.workspace,x.project),/read-only/);
 assert.throws(()=>normalizeRegisteredUsages({...x.data,probeOnly:false},x.workspace,x.project),/read-only/);
});
