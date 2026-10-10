import path = require('node:path');
import { readPrototypeConfig } from './core/config';
import { runStaticPrototype } from './core/engine';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i+1] : undefined;
}
const configPath = arg('--config');
if (!configPath) throw new Error('--config is required');
const resolved = path.resolve(configPath);
const config = readPrototypeConfig(resolved);
const workspaceRoot = path.dirname(resolved);
const result = runStaticPrototype({ workspaceRoot, config, mockDotnetAnalysis:arg('--mock-dotnet'), mockMaterialization:arg('--mock-materialization') });
process.stdout.write(result.markdown + '\n');
if (result.diagnostics.length) {
  process.stderr.write('\nDiagnostics:\n');
  for (const d of result.diagnostics) process.stderr.write(`- ${d.ruleId}: ${d.message}\n`);
}
