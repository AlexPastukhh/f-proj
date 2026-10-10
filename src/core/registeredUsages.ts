import fs = require('node:fs');
import path = require('node:path');
import { SourceRange } from './types';

export type UsageKind = 'registration' | 'feature-test' | 'project-source';
export type TargetKind = 'responsibility' | 'assertion';

export interface UsageReference {
  kind: UsageKind;
  source: SourceRange;
}
export interface RegisteredUsageTarget {
  kind: TargetKind;
  symbol: string;
  references: UsageReference[];
}
export interface RegisteredUsageResult {
  probeOnly: true;
  mutationSupported: false;
  targets: RegisteredUsageTarget[];
  diagnostics: string[];
}
export interface UsageAction { line: number; label: string; source: SourceRange }

function inside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!path.isAbsolute(relative) &&
    relative !== '..' && !relative.startsWith('..' + path.sep));
}

function object(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Defense in depth across the JSON worker process boundary. Each reference
// must be a real, project-local file with a correct literal source span.
export function normalizeRegisteredUsages(input: unknown, workspaceRoot: string, projectRoot: string): RegisteredUsageResult {
  if (!object(input) || input.probeOnly !== true || input.mutationSupported !== false ||
      !Array.isArray(input.targets) || !Array.isArray(input.diagnostics) ||
      !input.diagnostics.every((d:any) => typeof d === 'string')) {
    throw new Error('C# usage worker returned an invalid read-only result');
  }
  if (input.diagnostics.length) {
    if (input.targets.length) throw new Error('C# usage worker returned partial targets with diagnostics');
    return { probeOnly:true, mutationSupported:false, targets:[], diagnostics:input.diagnostics };
  }
  const workspace = fs.realpathSync(workspaceRoot);
  const project = fs.realpathSync(projectRoot);
  if (!inside(workspace, project)) throw new Error('C# usage project is outside the workspace');
  const targets: RegisteredUsageTarget[] = [];
  const seenSymbols = new Set<string>();
  for (const candidate of input.targets) {
    if (!object(candidate) || (candidate.kind !== 'responsibility' && candidate.kind !== 'assertion') ||
        typeof candidate.symbol !== 'string' || !candidate.symbol.trim() ||
        !Array.isArray(candidate.references) || candidate.references.length === 0 ||
        seenSymbols.has(candidate.symbol)) throw new Error('Invalid or duplicate registered C# usage target');
    seenSymbols.add(candidate.symbol);
    const references: UsageReference[] = [];
    for (const ref of candidate.references) {
      if (!object(ref) || !['registration','feature-test','project-source'].includes(ref.kind) ||
          !object(ref.source)) throw new Error('Invalid C# usage reference');
      const s = ref.source;
      if (typeof s.file !== 'string' || !path.isAbsolute(s.file) ||
          ![s.start,s.end,s.line,s.column].every((n:any) => Number.isSafeInteger(n)) ||
          s.start < 0 || s.end <= s.start || s.line <= 0 || s.column <= 0) {
        throw new Error('Invalid C# usage source range');
      }
      const file = fs.realpathSync(s.file);
      if (!inside(project, file) || !inside(workspace, file)) {
        throw new Error('C# usage reference escapes the configured project or workspace');
      }
      const text = fs.readFileSync(file,'utf8');
      const snippet = text.slice(s.start,s.end);
      const name = candidate.symbol.split('(')[0].split('.').at(-1);
      if (s.end > text.length || !name || snippet !== name) {
        throw new Error('C# usage source no longer matches its Roslyn symbol span; rerun the command');
      }
      const lines = text.slice(0,s.start).split(/\r?\n/);
      if (lines.length !== s.line || lines[lines.length-1].length+1 !== s.column) {
        throw new Error('C# usage source line/column changed; rerun the command');
      }
      references.push({kind:ref.kind,source:{file,start:s.start,end:s.end,line:s.line,column:s.column}});
    }
    if (!references.some(r => r.kind === 'registration')) {
      throw new Error('Registered C# usage target lacks its registration source');
    }
    targets.push({kind:candidate.kind,symbol:candidate.symbol,references});
  }
  return {probeOnly:true,mutationSupported:false,targets,diagnostics:[]};
}

export function renderRegisteredUsages(
  result: RegisteredUsageResult,
  featureSpaceId: string,
  sourceId: string,
  projectRoot: string,
  sourceHref: (source:SourceRange)=>string,
): {markdown:string; actions:UsageAction[]} {
  const lines = [
    '# Feature Projection — Registered C# Usages',
    '',
    '**Read-only.** Refactoring and Rename are not available. Each entry is an exact Roslyn symbol reference.',
    '',
    `FeatureSpace: \`${featureSpaceId}\` · Source: \`${sourceId}\``,
    `C# project: \`${projectRoot.replace(/\\/g,'/')}\``,
    '',
  ];
  const actions: UsageAction[] = [];
  if (result.diagnostics.length) {
    lines.push('## Unresolved registrations', '',
      'No partial usage results are shown.', '',
      ...result.diagnostics.map(x=>`- ${x}`), '');
  } else if (result.targets.length === 0) {
    lines.push('No registered C# responsibility or assertion methods found in this project.', '');
  } else {
    for (const target of result.targets) {
      lines.push(`## ${target.kind === 'responsibility' ? 'Responsibility' : 'Assertion helper'}: \`${target.symbol}\``, '');
      for (const ref of target.references) {
        const relative = path.relative(projectRoot,ref.source.file).replace(/\\/g,'/');
        const label = ref.kind === 'registration' ? 'Registration' : ref.kind === 'feature-test' ? 'Feature test' : 'Project source';
        const line = lines.length;
        const linkText = `${label} · ${relative}:${ref.source.line}`;
        lines.push(`- [${linkText}](${sourceHref(ref.source)})`);
        actions.push({line,label:`Open ${label.toLowerCase()} source`,source:ref.source});
      }
      lines.push('');
    }
  }
  return {markdown:lines.join('\n'), actions};
}
