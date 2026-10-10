import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { resolveExternalNodeRuntime, sanitizeExternalNodeEnvironment } = require('../dist/core/nodeRuntime.js')

test('external Node runtime prefers an explicit configured executable', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feature-projection-node-'))
  const node = path.join(dir, process.platform === 'win32' ? 'node.exe' : 'node')
  fs.writeFileSync(node, '')
  const resolved = resolveExternalNodeRuntime(node, { PATH:'' }, process.platform)
  assert.equal(resolved.command, node)
  assert.equal(resolved.source, 'configured')
})

test('an explicit missing nodePath remains authoritative so Refresh can report it', () => {
  const missing = path.join(os.tmpdir(), 'feature-projection-definitely-missing-node.exe')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feature-projection-node-fallback-'))
  const fallback = path.join(dir, 'node.exe')
  fs.writeFileSync(fallback, '')
  const resolved = resolveExternalNodeRuntime(missing, { PATH:dir }, 'win32')
  assert.equal(resolved.command, missing)
  assert.equal(resolved.source, 'configured')
})

test('external Node runtime resolves Node from PATH instead of using Electron process.execPath', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feature-projection-node-path-'))
  const platform = 'win32'
  const node = path.join(dir, 'node.exe')
  fs.writeFileSync(node, '')
  const resolved = resolveExternalNodeRuntime(undefined, { PATH:dir }, platform)
  assert.equal(resolved.command, node)
  assert.equal(resolved.source, 'path')
})


test('external Node worker environment strips VS Code/debugger process injection but preserves toolchain env', () => {
  const input = {
    PATH:'C:/Program Files/nodejs',
    HOME:'C:/Users/test',
    FEATURE_PROJECTION_KEEP:'yes',
    ELECTRON_RUN_AS_NODE:'1',
    NODE_OPTIONS:'--require C:/vscode/js-debug/bootloader.js',
    VSCODE_INSPECTOR_OPTIONS:'{\"inspectorIpc\":\"pipe\"}',
    DEBUG:'*',
    LD_PRELOAD:'inject.so',
    DYLD_INSERT_LIBRARIES:'inject.dylib',
  }
  const out = sanitizeExternalNodeEnvironment(input)
  assert.equal(out.env.PATH, input.PATH)
  assert.equal(out.env.HOME, input.HOME)
  assert.equal(out.env.FEATURE_PROJECTION_KEEP, 'yes')
  for (const key of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','VSCODE_INSPECTOR_OPTIONS','DEBUG','LD_PRELOAD','DYLD_INSERT_LIBRARIES'])
    assert.equal(out.env[key], undefined, key)
  assert.deepEqual(out.removed.sort(), ['DEBUG','DYLD_INSERT_LIBRARIES','ELECTRON_RUN_AS_NODE','LD_PRELOAD','NODE_OPTIONS','VSCODE_INSPECTOR_OPTIONS'].sort())
})
