import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const {buildProjectionDocument}=require('../dist/core/projectionDocument.js')
const {renderProjection}=require('../dist/core/projection.js')
const {renderPortableProjection}=require('../dist/core/portableProjection.js')
const {PORTABLE_HTML_MARKER,resolvePortableHtmlDirectory,writePortableHtmlAtomic,isPortableHtmlOutputPath}=
  require('../dist/core/portableHtmlStorage.js')

function source(file,line=7) {
  return {file,start:0,end:4,line,column:1}
}
function row(space='accounts',name='bad_password') {
  const identity={featureSpaceId:space,logicalFolderKey:'auth',featureName:'log_in',
    outcome:'rejected',situation:name}
  const backend={...identity,partRole:'backend',expectedBehavior:'reject_request',
    assertions:[{kind:'assertion',source:source('C:/App/back/Access Tests.cs',14),
      sourceCode:'Assert.Equal("<script>alert(1)</script>", result);'}],
    source:source('C:/App/back/Access Tests.cs',10),trust:'trusted',diagnostics:[]}
  return {...identity,backend}
}
function tempDir(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fp-portable-html-'))
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}))
  return dir
}
test('single detached internal JSON projection builds equivalent Markdown and HTML meaning',()=>{
  const original=[row('billing'),row('accounts')]
  const document=buildProjectionDocument(original)
  original[1].backend.expectedBehavior='changed_after_snapshot'
  assert.equal(document.kind,'feature-projection/internal')
  assert.equal(document.situations.length,2)
  assert.equal(JSON.parse(JSON.stringify(document)).situations.length,2)
  const markdown=renderProjection(document.situations)
  const html=renderPortableProjection(document.situations)
  assert.match(markdown.markdown,/Scope: accounts\/auth/)
  assert.match(html,/Scope: accounts \/ auth/)
  assert.equal((html.match(/Situation: <strong>bad_password<\/strong>/g)||[]).length,2)
  assert.equal((html.match(/No matching part\./g)||[]).length,2)
  assert.equal((html.match(/reject_request/g)||[]).length,2)
  assert.doesNotMatch(html,/changed_after_snapshot/)
  assert.ok(html.startsWith('<!doctype html>\n'+PORTABLE_HTML_MARKER+'\n'))
  assert.equal((html.match(/id="s-/g)||[]).length,2)
})
test('HTML escapes untrusted test contents and emits optional source links safely',()=>{
  const data=[row('accounts','<img src=x onerror=alert(1)>')]
  const link=()=> 'vscode://file/C:/App/back/Access%20Tests.cs:10:1'
  const html=renderPortableProjection(data,{sourceHref:link})
  assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/)
  assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.doesNotMatch(html,/<script>|<img src=x/i)
  assert.match(html,/href="vscode:\/\/file\/C:\/App\/back\/Access%20Tests.cs:10:1"/)
  assert.match(html,/Content-Security-Policy/)
  assert.doesNotMatch(html,/<script\b/i)
  const bad=renderPortableProjection(data,{sourceHref:()=> 'javascript:alert(1)'})
  assert.doesNotMatch(bad,/href="javascript:/)
  const injected=renderPortableProjection(data,{sourceHref:()=> 'vscode://file/C:/App/test" onclick="evil' })
  assert.doesNotMatch(injected,/onclick=/)
})
test('portable HTML directory defaults outside workspace and honors explicit localhost directory',(t)=>{
  const root=tempDir(t)
  const workspace=path.join(root,'workspace')
  const storage=path.join(root,'storage')
  fs.mkdirSync(workspace)
  const first=resolvePortableHtmlDirectory(storage,workspace)
  const second=resolvePortableHtmlDirectory(storage,workspace)
  assert.equal(first,second)
  assert.ok(first.startsWith(storage+path.sep))
  assert.ok(!first.startsWith(workspace+path.sep))
  assert.ok(first.endsWith(path.sep+path.basename(first)))
  const served=path.join(root,'localhost-assets')
  assert.equal(resolvePortableHtmlDirectory(storage,workspace,served),served)
  assert.throws(()=>resolvePortableHtmlDirectory(storage,workspace,'./assets'),/absolute path/)
})
test('generated HTML update is atomic, repeatable and never clobbers unrelated files',(t)=>{
  const root=tempDir(t)
  const html=renderPortableProjection([row()])
  const first=writePortableHtmlAtomic(root,html)
  assert.equal(path.basename(first.file),'projection.html')
  assert.equal(first.changed,true)
  assert.equal(fs.readFileSync(first.file,'utf8'),html)
  const second=writePortableHtmlAtomic(root,html)
  assert.equal(second.changed,false)
  assert.equal(second.file,first.file)
  const changed=renderPortableProjection([row('accounts','another_situation')])
  assert.equal(writePortableHtmlAtomic(root,changed).changed,true)
  assert.equal(fs.readFileSync(first.file,'utf8'),changed)
  assert.deepEqual(fs.readdirSync(root),['projection.html'])
  const foreign=tempDir(t)
  fs.writeFileSync(path.join(foreign,'projection.html'),'user document')
  assert.throws(()=>writePortableHtmlAtomic(foreign,html),/Refusing to overwrite/)
  assert.equal(fs.readFileSync(path.join(foreign,'projection.html'),'utf8'),'user document')
  assert.throws(()=>writePortableHtmlAtomic(root,'<html>fake</html>'),/Not a generated/)
})
test('duplicate scoped situations fail closed, while empty projection creates a safe document',()=>{
  const data=row()
  assert.throws(()=>buildProjectionDocument([data,data]),/Duplicate/)
  assert.throws(()=>renderPortableProjection([data,data]),/Duplicate/)
  assert.match(renderPortableProjection([]),/No Situations/)
  assert.equal(buildProjectionDocument([]).situations.length,0)
})

test('only generated HTML/temp files are omitted from watched source roots',(t)=>{
  const root=tempDir(t)
  const hosted=path.join(root,'frontend','public')
  const expected=path.join(hosted,'projection.html')
  const temp=path.join(hosted,'.projection-1234567890abcdef12345678.tmp')
  assert.equal(isPortableHtmlOutputPath(expected,hosted),true)
  assert.equal(isPortableHtmlOutputPath(temp,hosted),true)
  assert.equal(isPortableHtmlOutputPath(path.join(hosted,'other.html'),hosted),false)
  assert.equal(isPortableHtmlOutputPath(path.join(hosted,'feature.test.ts'),hosted),false)
  assert.equal(isPortableHtmlOutputPath(path.join(root,'backend','projection.html'),hosted),false)
  assert.equal(isPortableHtmlOutputPath(expected,undefined),false)
  assert.equal(isPortableHtmlOutputPath(expected,'./public'),false)
})
