import fs = require('node:fs');
import path = require('node:path');
import { SourceRange } from './types';

export interface RenamePreviewEdit extends SourceRange {
  oldText: string;
  newText: string;
}
export interface RenamePreviewResult {
  probeOnly: true;
  mutationSupported: false;
  projectScopeOnly: true;
  accepted: boolean;
  symbol: string;
  newName: string;
  edits: RenamePreviewEdit[];
  diagnostics: string[];
}
export interface RenamePreviewAction { line: number; label: string; source: SourceRange }

function isRecord(v: unknown): v is Record<string, any> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}
function inside(root: string, file: string): boolean {
  const rel = path.relative(root, file);
  return rel === '' || (!path.isAbsolute(rel) && rel !== '..' &&
    !rel.startsWith('..' + path.sep));
}

// The Roslyn worker is a process boundary. Never accept an applicable edit
// or a stale/partial preview. No WorkspaceEdit is constructed anywhere.
export function normalizeRenamePreview(
  value: unknown, workspaceRoot: string, projectRoot: string,
  expectedSymbol: string, expectedNewName: string,
): RenamePreviewResult {
  if (!isRecord(value) || value.probeOnly !== true ||
      value.mutationSupported !== false || value.projectScopeOnly !== true ||
      typeof value.accepted !== 'boolean' ||
      value.symbol !== expectedSymbol || value.newName !== expectedNewName ||
      !Array.isArray(value.edits) || !Array.isArray(value.diagnostics) ||
      !value.diagnostics.every((d:unknown) => typeof d === 'string')) {
    throw new Error('Invalid or mutating Roslyn Rename preview result');
  }
  if (!value.accepted) {
    if (value.edits.length || !value.diagnostics.length)
      throw new Error('Rejected rename preview must contain diagnostics and zero edits');
    return {probeOnly:true, mutationSupported:false, projectScopeOnly:true,
      accepted:false, symbol:expectedSymbol,newName:expectedNewName,
      edits:[],diagnostics:value.diagnostics};
  }
  if (value.diagnostics.length || value.edits.length === 0)
    throw new Error('Accepted rename preview cannot be partial or empty');

  const workspace = fs.realpathSync(workspaceRoot);
  const project = fs.realpathSync(projectRoot);
  if (!inside(workspace, project) || workspace === project)
    throw new Error('Rename preview project is not a child of workspace');
  const originalName = expectedSymbol.split('(')[0].split('.').at(-1);
  if (!originalName || !/^[A-Za-z_][A-Za-z_0-9]*$/.test(expectedNewName) ||
      originalName === expectedNewName)
    throw new Error('Unacceptable C# method identity or new identifier');

  const edits: RenamePreviewEdit[] = [];
  const seen = new Set<string>();
  for (const candidate of value.edits) {
    if (!isRecord(candidate) || typeof candidate.file !== 'string' ||
        !path.isAbsolute(candidate.file) ||
        ![candidate.start,candidate.end,candidate.line,candidate.column].every(
          (x:unknown) => Number.isSafeInteger(x)
        ) || candidate.start < 0 || candidate.end <= candidate.start ||
        candidate.line < 1 || candidate.column < 1 ||
        candidate.oldText !== originalName || candidate.newText !== expectedNewName)
      throw new Error('Invalid or unexpected Roslyn Rename token edit');

    const file = fs.realpathSync(candidate.file);
    if (!inside(project,file) || !inside(workspace,file) ||
        path.extname(file).toLowerCase() !== '.cs')
      throw new Error('Rename edit escapes selected C# project');
    const text = fs.readFileSync(file,'utf8');
    if (text.slice(candidate.start,candidate.end) !== originalName)
      throw new Error('Rename preview is stale; source token changed');
    const lines = text.slice(0,candidate.start).split(/\r?\n/);
    if (lines.length !== candidate.line ||
        lines[lines.length-1].length+1 !== candidate.column)
      throw new Error('Rename preview source line/column changed');
    const key = file.toLowerCase()+':'+candidate.start;
    if (seen.has(key)) throw new Error('Duplicate Rename preview source token');
    seen.add(key);
    edits.push({file,start:candidate.start,end:candidate.end,
      line:candidate.line,column:candidate.column,
      oldText:originalName,newText:expectedNewName});
  }
  return {probeOnly:true,mutationSupported:false,projectScopeOnly:true,
    accepted:true,symbol:expectedSymbol,newName:expectedNewName,
    edits,diagnostics:[]};
}

export function renderRenamePreview(
  result: RenamePreviewResult, featureSpaceId:string,
  sourceId:string, projectRoot:string, sourceHref:(source:SourceRange)=>string,
): {markdown:string; actions:RenamePreviewAction[]} {
  const safe = (s:string) => s.replace(/[`\\]/g, '_').replace(/[\r\n]/g, ' ');
  const lines = [
    '# Feature Projection — C# Rename Preview',
    '',
    '**READ-ONLY RESEARCH PREVIEW. No files are changed. There is no Apply or Confirm operation.**',
    '',
    'Only the selected C# project is analyzed. Other projects, runtime labels, strings, reflection and external clients are **not verified**.',
    '',
    `FeatureSpace: \`${safe(featureSpaceId)}\` · Source: \`${safe(sourceId)}\``,
    `C# project: \`${safe(projectRoot.replace(/\\/g,'/'))}\``,
    `Registered method: \`${safe(result.symbol)}\``,
    `Proposed name: \`${safe(result.newName)}\``,
    '',
  ];
  const actions:RenamePreviewAction[]=[];
  if (!result.accepted) {
    lines.push('## REFUSED — no preview edits', '',
      ...result.diagnostics.map(d => `- ${safe(d)}`), '');
  } else {
    lines.push(`## ${result.edits.length} proposed token change(s) — NOT APPLIED`, '');
    for(const edit of result.edits) {
      const relative=path.relative(projectRoot,edit.file).replace(/\\/g,'/');
      const line=lines.length;
      lines.push(`- [${safe(relative)}:${edit.line}:${edit.column}](${sourceHref(edit)}) — \`${edit.oldText}\` → \`${edit.newText}\``);
      actions.push({line,label:'Open original C# token (read-only preview)',source:edit});
    }
    lines.push('', 'The above is a research preview, **not an authorized cross-project rename plan**.', '');
  }
  return {markdown:lines.join('\n'),actions};
}
