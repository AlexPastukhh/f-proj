import path = require('node:path');
import { readPrototypeConfig } from './core/config';
import { runFullPrototype } from './core/fullEngine';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const configPath = path.resolve(arg('--config') ?? 'fixtures/feature-projection.config.json');
  const projectRoot = path.resolve(__dirname, '..');
  const config = readPrototypeConfig(configPath);
  const result = await runFullPrototype({
    workspaceRoot: path.dirname(configPath),
    config,
    trusted: true,
    vitestWorkerPath: path.resolve(projectRoot, 'workers/vitest-materialize.mjs'),
    dotnetWorkerDll: path.resolve(projectRoot, 'workers/dotnet/bin/Release/net8.0/FeatureProjection.DotNetWorker.dll'),
  });

  process.stdout.write(result.markdown + '\n');
  if (result.diagnostics.length) {
    process.stderr.write('\nDiagnostics:\n');
    for (const d of result.diagnostics)
      process.stderr.write(`- ${d.ruleId}: ${d.message}\n`);
  }

  if (result.diagnostics.some(d => d.projectionImpact === 'blocks-part'))
    process.exitCode = 2;
}

main().catch(err => {
  console.error(err?.stack ?? String(err));
  process.exitCode = 1;
});
