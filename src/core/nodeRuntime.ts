import fs = require('node:fs');
import path = require('node:path');

export interface NodeRuntimeResolution {
  command: string;
  source: 'configured' | 'path' | 'common-location' | 'fallback';
}

function existingFile(candidate: string | undefined): string | undefined {
  if (!candidate) return undefined;
  try {
    if (fs.statSync(candidate).isFile()) return candidate;
  } catch { /* not found */ }
  return undefined;
}

function pathEntries(env: Record<string, string | undefined>): string[] {
  const raw = env.PATH ?? env.Path ?? env.path ?? '';
  return raw.split(path.delimiter).map(x => x.trim()).filter(Boolean);
}

export function resolveExternalNodeRuntime(
  configuredPath: string | undefined,
  env: Record<string, string | undefined> = process.env,
  platform: string = process.platform,
): NodeRuntimeResolution {
  if (configuredPath?.trim()) {
    const configured = existingFile(configuredPath);
    // An explicit path is authoritative. Returning the configured value even when
    // it is missing lets the worker boundary emit an actionable nodePath diagnostic
    // instead of silently switching to a different Node installation.
    return { command: configured ?? configuredPath, source:'configured' };
  }

  const executableNames = platform === 'win32' ? ['node.exe', 'node.cmd', 'node.bat'] : ['node'];
  for (const dir of pathEntries(env)) {
    for (const name of executableNames) {
      const candidate = existingFile(path.join(dir, name));
      if (candidate) return { command:candidate, source:'path' };
    }
  }

  if (platform === 'win32') {
    const common = [
      env.ProgramFiles && path.join(env.ProgramFiles, 'nodejs', 'node.exe'),
      env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Programs', 'nodejs', 'node.exe'),
      env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'nodejs', 'node.exe'),
    ];
    for (const candidate of common) {
      const existing = existingFile(candidate);
      if (existing) return { command:existing, source:'common-location' };
    }
  }

  // Let child_process perform the final PATH lookup. If Node truly is unavailable,
  // the worker diagnostic will contain ENOENT instead of silently falling back to
  // the VS Code/Electron executable, which is not the framework project's Node runtime.
  return { command: platform === 'win32' ? 'node.exe' : 'node', source:'fallback' };
}
export interface SanitizedNodeWorkerEnvironment {
  env: Record<string, string | undefined>;
  removed: string[];
}

// VS Code/debugger processes can inject Node-specific environment variables into
// the Extension Host. Forwarding those variables to a framework worker makes the
// child runtime depend on the editor/debugger instead of the framework project.
// Keep the normal user/toolchain environment (PATH, HOME, npm config, etc.) but
// strip process-injection variables before starting the external Node worker.
export function sanitizeExternalNodeEnvironment(
  source: Record<string, string | undefined> = process.env,
): SanitizedNodeWorkerEnvironment {
  const env: Record<string, string | undefined> = { ...source };
  const removed: string[] = [];
  const keys = [
    'ELECTRON_RUN_AS_NODE',
    'NODE_OPTIONS',
    'VSCODE_INSPECTOR_OPTIONS',
    'DEBUG',
    'LD_PRELOAD',
    'DYLD_INSERT_LIBRARIES',
  ];
  for (const key of keys) {
    if (env[key] !== undefined) {
      delete env[key];
      removed.push(key);
    }
  }
  return { env, removed };
}
