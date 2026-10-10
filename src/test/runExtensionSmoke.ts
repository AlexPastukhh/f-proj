import fs = require('node:fs');
import path = require('node:path');
import childProcess = require('node:child_process');
import { runTests } from '@vscode/test-electron';

function copyFixtureTree(source: string, target: string, skippedNames: Set<string>) {
  fs.cpSync(source, target, {
    recursive:true,
    filter:(entry:string) => !skippedNames.has(path.basename(entry).toLowerCase()),
  });
}

function prepareConfigureWorkspace(extensionDevelopmentPath: string): string {
  const workspacePath = path.resolve(extensionDevelopmentPath, 'artifacts/configure-smoke-workspace');
  fs.rmSync(workspacePath, { recursive:true, force:true });
  fs.mkdirSync(path.join(workspacePath, '.vscode'), { recursive:true });

  const fixture = path.resolve(extensionDevelopmentPath, 'fixtures/workspace');
  const sourceFrontend = path.join(fixture, 'frontend');
  const targetFrontend = path.join(workspacePath, 'frontend');
  copyFixtureTree(sourceFrontend, targetFrontend, new Set(['node_modules']));
  fs.symlinkSync(path.join(sourceFrontend, 'node_modules'), path.join(targetFrontend, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');

  const targetBackend = path.join(workspacePath, 'backend');
  copyFixtureTree(path.join(fixture, 'backend'), targetBackend, new Set(['bin','obj']));
  childProcess.execFileSync('dotnet', ['restore', path.join(targetBackend, 'Backend.FeatureTests.csproj'), '--nologo'], { stdio:'inherit' });

  fs.writeFileSync(path.join(workspacePath, '.vscode', 'settings.json'), '{}\n', 'utf8');
  return workspacePath;
}

async function main() {
  const extensionDevelopmentPath = path.resolve(__dirname, '../..');
  const extensionTestsPath = path.resolve(__dirname, 'suite/index.js');
  const workspacePath = prepareConfigureWorkspace(extensionDevelopmentPath);
  const options: any = {
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs:[
      workspacePath,
      '--disable-extensions',
      '--disable-extension=github.copilot-chat',
      '--disable-gpu',
      '--disable-workspace-trust',
      '--skip-welcome',
      '--skip-release-notes',
    ],
  };
  if (process.env.VSCODE_EXECUTABLE_PATH)
    options.vscodeExecutablePath = process.env.VSCODE_EXECUTABLE_PATH;
  process.env.FEATURE_PROJECTION_TEST_MODE = '1';
  try {
    await runTests(options);
  } finally {
    delete process.env.FEATURE_PROJECTION_TEST_MODE;
    fs.rmSync(workspacePath, { recursive:true, force:true });
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
