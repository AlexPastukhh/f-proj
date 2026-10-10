from pathlib import Path
p=Path(r'C:\Users\alexa\Downloads\feature-projection-prototype-p0-0.1.0-release-gate\src\test\suite\index.ts')
s=p.read_text(encoding='utf-8').replace('\r\n','\n')
anchor="async function runUntrusted(folder: vscode.WorkspaceFolder, extension: any): Promise<void> {"
block="""async function runPrerequisite(folder: vscode.WorkspaceFolder, extension: any, kind: 'node'|'dotnet'): Promise<void> {
  assert.equal(vscode.workspace.isTrusted, true, 'prerequisite smoke must run trusted');
  await vscode.commands.executeCommand('featureProjection.refresh');
  const settled = await waitFor(debugState, state => state && !state.refreshing);
  const expectedRule = kind === 'node' ? 'worker/node-runtime-missing' : 'worker/dotnet-prerequisite-unavailable';
  const diagnostic = (settled.diagnostics ?? []).find((d:any) => d.ruleId === expectedRule);
  assert.ok(diagnostic, `missing prerequisite diagnostic ${expectedRule}: ${JSON.stringify(settled.diagnostics)}`);
  assert.equal(diagnostic.projectionImpact, 'blocks-part');
  assert.equal(settled.uiState, 'error');
  if (kind === 'node') assert.match(diagnostic.message, /featureProjection\.nodePath/);
  else assert.match(diagnostic.message, /compatible \.NET SDK\/runtime/);
  writeResult({
    ok:true,
    mode:`prerequisite-${kind}`,
    trusted:vscode.workspace.isTrusted,
    version:extension.packageJSON.version,
    extensionPath:extension.extensionPath,
    ruleId:diagnostic.ruleId,
    message:diagnostic.message,
    uiState:settled.uiState,
  });
}

"""+anchor
if anchor not in s: raise SystemExit('anchor missing')
s=s.replace(anchor,block,1)
old="""  if (process.env.FEATURE_PROJECTION_SMOKE_MODE === 'normal-hooks') return await runNormalHooks(folder, extension);
  if (process.env.FEATURE_PROJECTION_SMOKE_MODE === 'untrusted') return await runUntrusted(folder, extension);
"""
new="""  if (process.env.FEATURE_PROJECTION_SMOKE_MODE === 'normal-hooks') return await runNormalHooks(folder, extension);
  if (process.env.FEATURE_PROJECTION_SMOKE_MODE === 'prerequisite-node') return await runPrerequisite(folder, extension, 'node');
  if (process.env.FEATURE_PROJECTION_SMOKE_MODE === 'prerequisite-dotnet') return await runPrerequisite(folder, extension, 'dotnet');
  if (process.env.FEATURE_PROJECTION_SMOKE_MODE === 'untrusted') return await runUntrusted(folder, extension);
"""
if old not in s: raise SystemExit('dispatch missing')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8',newline='\n')
print('PATCH_PREREQ_SUITE_DONE')
