from pathlib import Path
root=Path(r'C:\Users\alexa\Downloads\feature-projection-prototype-p0-0.1.0-release-gate')

def edit(rel, old, new):
    p=root/rel
    s=p.read_text(encoding='utf-8').replace('\r\n','\n')
    if old not in s: raise SystemExit(f'{rel}: missing block')
    p.write_text(s.replace(old,new,1),encoding='utf-8',newline='\n')

suite='src/test/suite/index.ts'
marker="async function runUntrusted(folder: vscode.WorkspaceFolder, extension: any): Promise<void> {"
normal="""async function runNormalHooks(folder: vscode.WorkspaceFolder, extension: any): Promise<void> {
  const commands = await vscode.commands.getCommands(true);
  for (const publicCommand of ['featureProjection.show','featureProjection.configure','featureProjection.refresh','featureProjection.showOutput'])
    assert.ok(commands.includes(publicCommand), `public command must remain registered: ${publicCommand}`);
  assert.ok(!commands.includes('featureProjection.__configureTest'), 'normal installed session must not register __configureTest');
  assert.ok(!commands.includes('featureProjection.__debugState'), 'normal installed session must not register __debugState');
  writeResult({
    ok:true,
    mode:'normal-hooks',
    trusted:vscode.workspace.isTrusted,
    version:extension.packageJSON.version,
    extensionPath:extension.extensionPath,
    hiddenCommandsAbsent:true,
  });
}

"""+marker
edit(suite,marker,normal)
edit(suite,"  if (process.env.FEATURE_PROJECTION_SMOKE_MODE === 'untrusted') return await runUntrusted(folder, extension);","  if (process.env.FEATURE_PROJECTION_SMOKE_MODE === 'normal-hooks') return await runNormalHooks(folder, extension);\n  if (process.env.FEATURE_PROJECTION_SMOKE_MODE === 'untrusted') return await runUntrusted(folder, extension);")

second='scripts/verify-second-workspace.ps1'
edit(second,'$env:FEATURE_PROJECTION_SMOKE_MODE = "scope-isolation"','$env:FEATURE_PROJECTION_SMOKE_MODE = "scope-isolation"\n$env:FEATURE_PROJECTION_TEST_MODE = "1"')
edit(second,'Remove-Item Env:FEATURE_PROJECTION_SMOKE_MODE -ErrorAction SilentlyContinue','Remove-Item Env:FEATURE_PROJECTION_SMOKE_MODE -ErrorAction SilentlyContinue\nRemove-Item Env:FEATURE_PROJECTION_TEST_MODE -ErrorAction SilentlyContinue')
print('PATCH_SMOKES_DONE')
