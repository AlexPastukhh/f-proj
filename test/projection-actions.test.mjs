import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { renderProjection } = require('../dist/core/projection.js')

test('rendered projection exposes source actions for matched frontend/backend parts', () => {
  const mkPart = (role, file, expectedBehavior) => ({
    featureSpaceId:'app', logicalFolderKey:'login', featureName:'login', outcome:'invalid_user_input', situation:'passwords_dont_match',
    partRole:role, expectedBehavior, assertions:[], source:{file,start:0,end:1,line:12,column:3}, diagnostics:[], trust:'trusted',
  })
  const rendered = renderProjection([{
    featureSpaceId:'app', logicalFolderKey:'login', featureName:'login', outcome:'invalid_user_input', situation:'passwords_dont_match',
    frontend:mkPart('frontend','/front.ts','error_is_shown'),
    backend:mkPart('backend','/back.cs','authentication_fails'),
  }])
  assert.equal(rendered.sourceActions.length, 2)
  assert.deepEqual(rendered.sourceActions.map(x => x.label), ['Open Frontend source','Open Backend source'])
  assert.equal(rendered.sourceActions[0].source.file, '/front.ts')
  assert.match(rendered.markdown, /Frontend/)
  assert.match(rendered.markdown, /Backend/)
})


test('literal assertion and responsibility snippets expose their own source navigation without moving part links', () => {
  const partSource = {file:'/repo/auth.cs',start:0,end:1,line:7,column:3}
  const verification = {file:'/repo/auth.cs',start:121,end:175,line:13,column:5}
  const assertion = {file:'/repo/auth.cs',start:220,end:240,line:16,column:5}
  const row = {
    featureSpaceId:'app',logicalFolderKey:'auth',featureName:'access',
    outcome:'denied',situation:'invalid_password',
  }
  const rendered = renderProjection([{
    ...row,
    backend:{
      ...row,partRole:'backend',source:partSource,expectedBehavior:'authentication_is_rejected',
      assertions:[
        {kind:'responsibility',source:verification,sourceCode:'user.Verify(x => x.Authenticate("invalid"), Times.Once);'},
        {kind:'assertion',source:assertion,sourceCode:'Assert.True(true);'},
      ],
      diagnostics:[],trust:'trusted'
    },
  }], {sourceHref:source=>`vscode://file${source.file}:${source.line}:${source.column}`})
  assert.equal(rendered.sourceActions.length,1)
  assert.equal(rendered.sourceActions[0].source.line,7)
  assert.deepEqual(rendered.assertionSourceActions.map(x=>[x.source.line,x.label]),[
    [13,'Open responsibility verification source'],[16,'Open assertion source']
  ])
  assert.match(rendered.markdown,/\[Open responsibility verification source\]\(vscode:\/\/file\/repo\/auth\.cs:13:5\)/)
  assert.match(rendered.markdown,/\[Open assertion source\]\(vscode:\/\/file\/repo\/auth\.cs:16:5\)/)
  assert.match(rendered.markdown,/user\.Verify\(x => x\.Authenticate\("invalid"\), Times\.Once\);/)
  assert.match(rendered.markdown,/Assert\.True\(true\);/)
  const lines=rendered.markdown.split('\n')
  for(const action of rendered.assertionSourceActions) assert.match(lines[action.line],/Open .* source/)
})

test('rendered projection can expose markdown-native source links without losing CodeLens actions', () => {
  const part = {
    featureSpaceId:'app', logicalFolderKey:'login', featureName:'login', outcome:'invalid_user_input', situation:'email_has_invalid_format',
    partRole:'frontend', expectedBehavior:'error_is_shown', assertions:[{sourceCode:'expect(screen.getByRole("alert")).toBeVisible()'}],
    source:{file:'C:\\repo\\frontend\\login.feature.test.ts',start:0,end:1,line:27,column:5}, diagnostics:[], trust:'trusted',
  }
  const rendered = renderProjection([{
    featureSpaceId:'app', logicalFolderKey:'login', featureName:'login', outcome:'invalid_user_input', situation:'email_has_invalid_format', frontend:part,
  }], {
    sourceHref: source => `vscode://file/C:/repo/frontend/login.feature.test.ts:${source.line}:${source.column}`,
  })

  assert.match(rendered.markdown, /\[Frontend · login\.feature\.test\.ts:27\]\(vscode:\/\/file\/C:\/repo\/frontend\/login\.feature\.test\.ts:27:5\)/)
  assert.match(rendered.markdown, /```[\s\S]*expect\(screen\.getByRole\("alert"\)\)\.toBeVisible\(\)[\s\S]*```/)
  assert.equal(rendered.sourceActions.length, 1)
  assert.equal(rendered.sourceActions[0].source.line, 27)
})
