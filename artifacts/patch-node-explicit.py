from pathlib import Path
root=Path(r'C:\Users\alexa\Downloads\feature-projection-prototype-p0-0.1.0-release-gate')
p=root/'src/core/nodeRuntime.ts'
s=p.read_text(encoding='utf-8').replace('\r\n','\n')
old="""  const configured = existingFile(configuredPath);
  if (configured) return { command: configured, source:'configured' };

  const executableNames = platform === 'win32' ? ['node.exe', 'node.cmd', 'node.bat'] : ['node'];
"""
new="""  if (configuredPath?.trim()) {
    const configured = existingFile(configuredPath);
    // An explicit path is authoritative. Returning the configured value even when
    // it is missing lets the worker boundary emit an actionable nodePath diagnostic
    // instead of silently switching to a different Node installation.
    return { command: configured ?? configuredPath, source:'configured' };
  }

  const executableNames = platform === 'win32' ? ['node.exe', 'node.cmd', 'node.bat'] : ['node'];
"""
if old not in s: raise SystemExit('nodeRuntime block missing')
p.write_text(s.replace(old,new,1),encoding='utf-8',newline='\n')

p=root/'test/node-runtime.test.mjs'
s=p.read_text(encoding='utf-8').replace('\r\n','\n')
anchor="""test('external Node runtime resolves Node from PATH instead of using Electron process.execPath', () => {
"""
testblock="""test('an explicit missing nodePath remains authoritative so Refresh can report it', () => {
  const missing = path.join(os.tmpdir(), 'feature-projection-definitely-missing-node.exe')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feature-projection-node-fallback-'))
  const fallback = path.join(dir, 'node.exe')
  fs.writeFileSync(fallback, '')
  const resolved = resolveExternalNodeRuntime(missing, { PATH:dir }, 'win32')
  assert.equal(resolved.command, missing)
  assert.equal(resolved.source, 'configured')
})

"""+anchor
if anchor not in s: raise SystemExit('node test anchor missing')
p.write_text(s.replace(anchor,testblock,1),encoding='utf-8',newline='\n')
print('PATCH_NODE_EXPLICIT_DONE')
