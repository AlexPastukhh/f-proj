import fs = require('node:fs');
import path = require('node:path');
import { analyzeVitestSource } from '../adapters/vitestSource';
import { PrototypeConfig, FrameworkConcreteCase, TestDefinition } from './types';
import { expandDefinitions, joinParts, renderMarkdown } from './projection';

export interface RunOptions {
  workspaceRoot: string;
  config: PrototypeConfig;
  mockDotnetAnalysis?: string;
  mockMaterialization?: string;
}

function readJson<T>(p: string): T { return JSON.parse(fs.readFileSync(path.resolve(p),'utf8')) as T; }

export function runStaticPrototype(options: RunOptions) {
  const definitions: TestDefinition[] = [];
  const cases: FrameworkConcreteCase[] = [];
  for (const space of options.config.featureSpaces) {
    for (const source of space.sources) {
      if (source.adapter === 'vitest-5') definitions.push(...analyzeVitestSource(source, space.id, options.workspaceRoot));
    }
  }
  if (options.mockDotnetAnalysis) definitions.push(...readJson<{definitions:TestDefinition[]}>(options.mockDotnetAnalysis).definitions);
  if (options.mockMaterialization) cases.push(...readJson<{cases:FrameworkConcreteCase[]}>(options.mockMaterialization).cases);
  const expanded = expandDefinitions(definitions, cases);
  const joined = joinParts(expanded.parts);
  return { definitions, cases, parts:expanded.parts, diagnostics:expanded.diagnostics, joined, markdown:renderMarkdown(joined) };
}
