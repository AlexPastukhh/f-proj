import fs = require('node:fs');
import path = require('node:path');
import vscode = require('vscode');
import { runFullPrototype } from './core/fullEngine';
import { planVitestSituationRun } from './core/situationRunPlan';
import { planXunitBackendRun } from './core/xunitBackendRun';
import { planRunBoth, executeRunBoth } from './core/runBothSituation';
import { runExactXunitFact, inspectExactXunitCase } from './core/xunitFactRunner';
import { runExactVitestSituation } from './core/vitestSituationRunner';
import { Diagnostic, FeatureSourceConfig, PrototypeConfig, SourceRange, JoinedSituation, TestDefinition, FrameworkConcreteCase } from './core/types';
import { buildTestingTree, TestingTreeNode } from './core/testingTree';
import { ProjectionSourceAction, ProjectionSituationAction, renderProjection } from './core/projection';
import { runProcess, runJsonWorker } from './core/process';
import { normalizeRegisteredUsages, renderRegisteredUsages, UsageAction } from './core/registeredUsages';
import { normalizeRenamePreview, renderRenamePreview, RenamePreviewAction } from './core/renamePreview';
import { resolveExternalNodeRuntime, sanitizeExternalNodeEnvironment } from './core/nodeRuntime';
import { validatePrototypeConfig } from './core/configValidation';
import { applySourceConfigurationChange, SourceConfigurationChange } from './core/configureModel';
import { isFeatureProjectionTestMode } from './core/testMode';
import { buildProjectionDocument } from './core/projectionDocument';
import { renderPortableProjection } from './core/portableProjection';
import { resolvePortableHtmlDirectory, writePortableHtmlAtomic, isPortableHtmlOutputPath } from './core/portableHtmlStorage';

const scheme = 'feature-projection';
const projectionUri = vscode.Uri.parse(`${scheme}:/projection.md`);
const registeredUsagesUri = (featureSpaceId:string, sourceId:string) =>
  vscode.Uri.parse(`${scheme}:/usages/${encodeURIComponent(featureSpaceId)}/${encodeURIComponent(sourceId)}.md`);
const registeredRenameUri = (featureSpaceId:string, sourceId:string, symbol:string, newName:string) =>
  vscode.Uri.parse(`${scheme}:/rename-preview/${encodeURIComponent(featureSpaceId)}/${encodeURIComponent(sourceId)}/${encodeURIComponent(symbol)}/${encodeURIComponent(newName)}.md`);
let lastMarkdown = '# Feature Projection\n\nRun **Feature Projection: Refresh**.';
let lastSourceActions: ProjectionSourceAction[] = [];
let lastAssertionSourceActions: ProjectionSourceAction[] = [];
let lastSituationActions: ProjectionSituationAction[] = [];
let lastUsageMarkdown = '# Registered C# Usages\n\nRun **Feature Projection: Show Registered C# Usages**.';
let lastUsageActions: UsageAction[] = [];
const usageDocuments = new Map<string, {markdown:string; actions:UsageAction[]}>();
const renameDocuments = new Map<string, {markdown:string; actions:RenamePreviewAction[]}>();

function sourceDeepLink(source: SourceRange): string {
  const normalized = source.file.replace(/\\/g, '/');
  const absolute = normalized.startsWith('/') ? normalized : `/${normalized}`;
  const encodedPath = absolute.split('/').map(segment => /^[A-Za-z]:$/.test(segment) ? segment : encodeURIComponent(segment)).join('/');
  return `${vscode.env.uriScheme}://file${encodedPath}:${source.line}:${source.column}`;
}

type UiState = 'fresh' | 'stale' | 'refreshing' | 'error';

export function activate(context: any) {
  const emitter = new vscode.EventEmitter();
  const collection = vscode.languages.createDiagnosticCollection('featureProjection');
  const output = vscode.window.createOutputChannel('Feature Projection');
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  const provider = { onDidChange: emitter.event, provideTextDocumentContent: (uri:any) =>
    uri.path.startsWith('/rename-preview/')
      ? (renameDocuments.get(uri.toString())?.markdown ?? '# Rename Preview\n\nNo query has been run.')
      : uri.path.startsWith('/usages/')
      ? (usageDocuments.get(uri.toString())?.markdown ?? '# Registered C# Usages\n\nNo query has been run.')
      : lastMarkdown };
  const testController = vscode.tests.createTestController('featureProjection', 'Feature Projection');
  const frontendTag = new vscode.TestTag('featureProjection.frontend');
  const backendTag = new vscode.TestTag('featureProjection.backend');

  let uiState: UiState = 'stale';
  let hasProjection = false;
  let lastPortableHtmlFile: string | undefined;
  let refreshing = false;
  let staleRequestedDuringRefresh = false;
  let stalePromptOpen = false;
  let lastDiagnostics: Diagnostic[] = [];
  let lastTestingTree: TestingTreeNode[] = [];
  let situationTestItems = new Map<string, any>();
  let runSnapshot: {
    workspaceRoot:string; config:PrototypeConfig;
    joined:JoinedSituation[]; definitions:TestDefinition[]; cases:FrameworkConcreteCase[];
  } | undefined;
  let fileWatchers: any[] = [];

  const timestamp = () => new Date().toISOString();
  const log = (message: string) => {
    for (const line of String(message).split(/\r?\n/))
      output.appendLine(`[${timestamp()}] ${line}`);
  };

  const setState = (state: UiState, detail?: string) => {
    uiState = state;
    if (state !== 'fresh') runSnapshot = undefined;
    if (state === 'fresh') {
      status.text = '$(check) Feature Projection: Fresh';
      status.tooltip = detail ?? 'Projection is up to date. Click to show it.';
      status.command = 'featureProjection.show';
    } else if (state === 'stale') {
      status.text = '$(sync) Feature Projection: Stale';
      status.tooltip = detail ?? 'Relevant project files changed. Click to refresh.';
      status.command = 'featureProjection.refresh';
    } else if (state === 'refreshing') {
      status.text = '$(sync~spin) Feature Projection: Refreshing';
      status.tooltip = detail ?? 'Feature Projection refresh is running.';
      status.command = undefined;
    } else {
      status.text = '$(error) Feature Projection: Error';
      status.tooltip = detail ?? 'Projection has blocking diagnostics. Click to open the Feature Projection output.';
      status.command = 'featureProjection.showOutput';
    }
    status.show();
  };

  setState('stale', 'Feature Projection has not been refreshed in this window yet. Click to refresh.');
  log(`extension activated; execPath=${process.execPath}`);
  log(`host versions: node=${process.versions.node ?? 'unknown'} electron=${(process.versions as any).electron ?? 'n/a'}`);

  context.subscriptions.push(
    collection,
    output,
    status,
    testController,
    vscode.workspace.registerTextDocumentContentProvider(scheme, provider),
  );

  const show = async () => {
    const doc = await vscode.workspace.openTextDocument(projectionUri);
    await vscode.window.showTextDocument(doc, { preview:false });
  };

  const showOutput = () => output.show(true);
  const openPortableHtml = async ():Promise<boolean> => {
    if (!vscode.workspace.isTrusted || uiState !== 'fresh') {
      void vscode.window.showWarningMessage(
        'Feature Projection: HTML can be opened only after a fresh, trusted Refresh.'
      );
      return false;
    }
    if (!lastPortableHtmlFile || !fs.existsSync(lastPortableHtmlFile)) {
      void vscode.window.showInformationMessage(
        'Feature Projection: run a successful trusted Refresh to generate projection.html first.'
      );
      return false;
    }
    return await vscode.env.openExternal(vscode.Uri.file(lastPortableHtmlFile));
  };

  const selectedSituationId = (argument: any): string | undefined => {
    const candidate = typeof argument === 'string' ? argument : argument?.id;
    if (typeof candidate !== 'string') return undefined;
    if (situationTestItems.has(candidate)) return candidate;
    // A context menu may be invoked on the Frontend/Backend child of a Situation.
    // Only known published Situation IDs can be resolved; never search by label.
    for (const role of ['/frontend', '/backend']) {
      if (!candidate.endsWith(role)) continue;
      const parent = candidate.slice(0, -role.length);
      if (situationTestItems.has(parent)) return parent;
    }
    return undefined;
  };

  const revealSituationInTestExplorer = async (argument?: any): Promise<boolean> => {
    if (!hasProjection || !situationTestItems.size) {
      log('cross-navigation: no published Situations to reveal');
      vscode.window.showWarningMessage('Feature Projection: Refresh to publish Situations in Test Explorer.');
      return false;
    }

    let id: string | undefined;
    if (argument === undefined) {
      // The Command Palette has no TestItem context. Select from fully scoped
      // identities; never resolve a duplicated Situation by its label alone.
      const candidates: Array<{ label:string; description:string; detail:string; testId:string }> = [];
      for (const feature of lastTestingTree) {
        for (const outcome of feature.children) {
          for (const situation of outcome.children) {
            if (situation.kind !== 'situation' || !situationTestItems.has(situation.id)) continue;
            candidates.push({
              label:situation.label,
              description:`${feature.label} → ${outcome.label}`,
              detail:situation.id,
              testId:situation.id,
            });
          }
        }
      }
      const selected = await vscode.window.showQuickPick(candidates, {
        placeHolder:'Select a concrete Situation (FeatureSpace / feature / outcome)',
        matchOnDescription:true,
      });
      if (!selected) return false;
      id = selected.testId;
    } else {
      id = selectedSituationId(argument);
    }
    const testItem = id ? situationTestItems.get(id) : undefined;
    if (!id || !testItem) {
      log('cross-navigation: unknown or stale Situation TestItem; reveal refused');
      return false;
    }

    try {
      log(`cross-navigation: reveal requested for ${id} (via ${argument === undefined ? 'Command Palette' : 'CodeLens'})`);
      // The documented command requests the Testing view and reveals this
      // exact published TestItem. No extra guessed internal view command.
      // Successful dispatch alone does not prove visible selection.
      await vscode.commands.executeCommand('vscode.revealTestInExplorer', testItem);
      log(`cross-navigation: native reveal dispatched for ${id}`);
      vscode.window.setStatusBarMessage(
        `Feature Projection: reveal requested in Testing — ${testItem.label}`, 5000
      );
      return true;
    } catch (err: any) {
      log(`cross-navigation: reveal failed for ${id}: ${err?.stack ?? err}`);
      vscode.window.showWarningMessage('Feature Projection: could not reveal Situation in Test Explorer. See Show Output.');
      return false;
    }
  };

  const openSituationInProjection = async (argument: any): Promise<boolean> => {
    const id = selectedSituationId(argument);
    const action = id ? lastSituationActions.find(a => a.testId === id) : undefined;
    if (!id || !action || !hasProjection) {
      log('cross-navigation: no published projection Situation for requested TestItem');
      return false;
    }
    const doc = await vscode.workspace.openTextDocument(projectionUri);
    const editor = await vscode.window.showTextDocument(doc, { preview:false });
    const point = new vscode.Position(action.line, 0);
    const range = new vscode.Range(point, point);
    editor.selection = new vscode.Selection(point, point);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    return true;
  };

  const openSource = async (source: SourceRange) => {
    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(source.file));
      const editor = await vscode.window.showTextDocument(doc, { preview:false });
      const line = Math.max(0, source.line - 1);
      const col = Math.max(0, source.column - 1);
      const range = new vscode.Range(line, col, line, col + 1);
      editor.selection = new vscode.Selection(range.start, range.start);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    } catch (err: any) {
      log(`open source failed: ${err?.stack ?? err}`);
      vscode.window.showErrorMessage(`Feature Projection: cannot open source: ${err?.message ?? err}`);
    }
  };

  const codeLensProvider = {
    provideCodeLenses: (doc:any) => doc.uri.path.startsWith('/rename-preview/')
      ? (renameDocuments.get(doc.uri.toString())?.actions ?? []).map(action => new vscode.CodeLens(
        new vscode.Range(action.line,0,action.line,0),{
          title:action.label,
          command:'featureProjection.openSource',
          arguments:[action.source],
        },
      ))
      : doc.uri.path.startsWith('/usages/')
      ? (usageDocuments.get(doc.uri.toString())?.actions ?? []).map(action => new vscode.CodeLens(
        new vscode.Range(action.line,0,action.line,0), {
          title:action.label,
          command:'featureProjection.openSource',
          arguments:[action.source],
        },
      ))
      : [
      ...lastSourceActions.map(action => {
        const range = new vscode.Range(action.line, 0, action.line, 0);
        return new vscode.CodeLens(range, {
          title: action.label,
          command: 'featureProjection.openSource',
          arguments: [action.source],
        });
      }),
      ...lastAssertionSourceActions.map(action => new vscode.CodeLens(
        new vscode.Range(action.line, 0, action.line, 0), {
          title:action.label,
          command:'featureProjection.openSource',
          arguments:[action.source],
        },
      )),
      ...lastSituationActions.map(action => new vscode.CodeLens(
        new vscode.Range(action.line, 0, action.line, 0), {
          title:'Reveal Situation in Test Explorer',
          command:'featureProjection.revealSituationInTestExplorer',
          arguments:[action.testId],
        },
      )),
    ],
  };
  context.subscriptions.push(vscode.languages.registerCodeLensProvider({ scheme }, codeLensProvider));

  const publishDiagnostics = (diagnostics: Diagnostic[]) => {
    lastDiagnostics = diagnostics;
    collection.clear();
    const grouped = new Map<string, any[]>();
    for (const d of diagnostics) {
      log(`diagnostic ${d.severity}/${d.projectionImpact} ${d.ruleId}: ${d.message}`);
      if (!d.source?.file) continue;
      const line = Math.max(0, d.source.line - 1), col = Math.max(0, d.source.column - 1);
      const severity = d.severity === 'error' ? vscode.DiagnosticSeverity.Error : d.severity === 'warning' ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Information;
      const vd = new vscode.Diagnostic(new vscode.Range(line,col,line,col+1), `[${d.ruleId}] ${d.message}`, severity);
      vd.source = 'Feature Projection';
      const uri = vscode.Uri.file(d.source.file).toString();
      const arr = grouped.get(uri) ?? []; arr.push(vd); grouped.set(uri, arr);
    }
    for (const [uri, ds] of grouped) collection.set(vscode.Uri.parse(uri), ds);
  };

  const createTestItem = (node: TestingTreeNode, index: Map<string, any>): any => {
    const uri = node.source?.file ? vscode.Uri.file(node.source.file) : undefined;
    const item = testController.createTestItem(node.id, node.label, uri);
    if (node.description) item.description = node.description;
    if (node.error) item.error = node.error;

    if (node.source) {
      const line = Math.max(0, node.source.line - 1);
      const col = Math.max(0, node.source.column - 1);
      item.range = new vscode.Range(line, col, line, col + 1);
    }

    if (node.role === 'frontend') item.tags = [frontendTag];
    if (node.role === 'backend') item.tags = [backendTag];

    if (node.kind === 'situation') index.set(node.id, item);
    item.children.replace(node.children.map(child => createTestItem(child, index)));
    return item;
  };

  const publishTestingTree = (joined: any[], definitions: any[], diagnostics: Diagnostic[]) => {
    const model = buildTestingTree(joined, definitions, diagnostics);
    const index = new Map<string, any>();
    const items = model.map(node => createTestItem(node, index));
    testController.items.replace(items);
    lastTestingTree = model;
    situationTestItems = index;
  };

  const getConfig = (folder?: any): PrototypeConfig => {
    const cfg = vscode.workspace.getConfiguration('featureProjection', folder?.uri);
    return {
      featureSpaces: cfg.get('featureSpaces') ?? [],
      workerTimeoutMs: cfg.get('workerTimeoutMs') ?? 30000,
      buildTimeoutMs: cfg.get('buildTimeoutMs') ?? 120000,
      nodePath: cfg.get('nodePath') ?? undefined,
      portableHtmlDirectory: cfg.get('portableHtmlDirectory') ?? undefined,
    };
  };

  const relativePathInside = (basePath: string, targetPath: string): string | undefined => {
    const rel = path.relative(path.resolve(basePath), path.resolve(targetPath));
    if (rel.startsWith('..') || path.isAbsolute(rel)) return undefined;
    return (rel || '.').split(path.sep).join('/');
  };

  const configureWorkspaceFolder = (showErrors: boolean): any | undefined => {
    const folders = vscode.workspace.workspaceFolders ?? [];
    if (folders.length === 1) return folders[0];
    if (showErrors) {
      const message = folders.length === 0
        ? 'Feature Projection: open a workspace before configuring.'
        : 'Feature Projection: Configure supports one workspace folder in 0.0.13. Open a single-folder workspace and try again.';
      void vscode.window.showErrorMessage(message);
    }
    return undefined;
  };

  const persistSourceConfiguration = async (folder: any, change: SourceConfigurationChange) => {
    const current = getConfig(folder);
    const draft = applySourceConfigurationChange(current, change);
    const draftValidation = validatePrototypeConfig(draft, folder.uri.fsPath);
    const blocking = draftValidation.diagnostics.filter(d => d.projectionImpact === 'blocks-part');
    if (blocking.length) {
      for (const d of draftValidation.diagnostics) log(`configure diagnostic ${d.ruleId}: ${d.message}`);
      return { ok:false, diagnostics:draftValidation.diagnostics, config:current, persisted:false };
    }

    const scoped = vscode.workspace.getConfiguration('featureProjection', folder.uri);
    await scoped.update('featureSpaces', draft.featureSpaces, vscode.ConfigurationTarget.Workspace);
    const persisted = getConfig(folder);
    const persistedValidation = validatePrototypeConfig(persisted, folder.uri.fsPath);
    const persistedBlocking = persistedValidation.diagnostics.filter(d => d.projectionImpact === 'blocks-part');
    if (persistedBlocking.length) {
      await scoped.update('featureSpaces', current.featureSpaces, vscode.ConfigurationTarget.Workspace);
      for (const d of persistedValidation.diagnostics) log(`configure persisted diagnostic ${d.ruleId}: ${d.message}`);
      return { ok:false, diagnostics:persistedValidation.diagnostics, config:current, persisted:false };
    }
    log(`configure saved: FeatureSpace=${change.featureSpaceId}; source=${change.source.id}; role=${change.source.role}; adapter=${change.source.adapter}`);
    return { ok:true, diagnostics:persistedValidation.diagnostics, config:persisted, persisted:true };
  };

  const configure = async () => {
    const folder = configureWorkspaceFolder(true);
    if (!folder) return;
    const current = getConfig(folder);

    let featureSpaceId: string | undefined;
    const spaces = current.featureSpaces ?? [];
    if (spaces.length) {
      const picked: any = await vscode.window.showQuickPick([
        ...spaces.map(space => ({ label:space.id, description:`${space.sources?.length ?? 0} source(s)`, id:space.id })),
        { label:'$(add) Create new FeatureSpace', id:'__new__' },
      ], { placeHolder:'Select or create a FeatureSpace' });
      if (!picked) return;
      if (picked.id !== '__new__') featureSpaceId = picked.id;
    }
    if (!featureSpaceId) {
      featureSpaceId = await vscode.window.showInputBox({
        prompt:'FeatureSpace id', placeHolder:'app',
        validateInput:(value:string) => !value.trim() ? 'FeatureSpace id is required.' : spaces.some(space => space.id === value.trim()) ? 'FeatureSpace id already exists; select it instead.' : undefined,
      });
      featureSpaceId = featureSpaceId?.trim();
      if (!featureSpaceId) return;
    }

    const targetSpace = spaces.find(space => space.id === featureSpaceId);
    const existingSources = targetSpace?.sources ?? [];
    let existingSource: FeatureSourceConfig | undefined;
    if (existingSources.length) {
      const picked: any = await vscode.window.showQuickPick([
        ...existingSources.map(source => ({ label:source.id, description:`${source.role} · ${source.adapter}`, source })),
        { label:'$(add) Add source', source:undefined },
      ], { placeHolder:`Configure source in FeatureSpace '${featureSpaceId}'` });
      if (!picked) return;
      existingSource = picked.source;
    }

    const rolePick: any = await vscode.window.showQuickPick([
      { label:'Frontend', value:'frontend' },
      { label:'Backend', value:'backend' },
    ], { placeHolder:'Source role' });
    if (!rolePick) return;
    const role = rolePick.value as 'frontend'|'backend';

    const sourceId = (await vscode.window.showInputBox({
      prompt:'FeatureSource id', value:existingSource?.id ?? role,
      validateInput:(value:string) => {
        const id = value.trim();
        if (!id) return 'FeatureSource id is required.';
        const duplicate = existingSources.some(source => source.id === id && source.id !== existingSource?.id);
        return duplicate ? `FeatureSource id '${id}' already exists in this FeatureSpace.` : undefined;
      },
    }))?.trim();
    if (!sourceId) return;

    const sourceRootPick = await vscode.window.showOpenDialog({
      canSelectFiles:false, canSelectFolders:true, canSelectMany:false,
      defaultUri:existingSource?.root ? vscode.Uri.file(path.resolve(folder.uri.fsPath, existingSource.root)) : folder.uri,
      openLabel:'Use as feature source root',
    });
    if (!sourceRootPick?.length) return;
    const root = relativePathInside(folder.uri.fsPath, sourceRootPick[0].fsPath);
    if (root === undefined) return void vscode.window.showErrorMessage('Feature Projection: source root must be inside the workspace folder.');

    const adapterPick: any = await vscode.window.showQuickPick([
      { label:'Vitest 5', description:'TypeScript / JavaScript', value:'vitest-5' },
      { label:'xUnit.net v3', description:'C# / .NET', value:'xunit-v3' },
    ], { placeHolder:'Framework adapter' });
    if (!adapterPick) return;
    const adapter = adapterPick.value as 'vitest-5'|'xunit-v3';

    const frameworkPick = await vscode.window.showOpenDialog({
      canSelectFiles:false, canSelectFolders:true, canSelectMany:false,
      defaultUri:existingSource?.frameworkProject ? vscode.Uri.file(path.resolve(folder.uri.fsPath, existingSource.frameworkProject)) : folder.uri,
      openLabel:'Use as framework project root',
    });
    if (!frameworkPick?.length) return;
    const frameworkProject = relativePathInside(folder.uri.fsPath, frameworkPick[0].fsPath);
    if (frameworkProject === undefined) return void vscode.window.showErrorMessage('Feature Projection: framework project must be inside the workspace folder.');
    const frameworkRoot = path.resolve(folder.uri.fsPath, frameworkProject);

    let projectFile: string | undefined;
    let configFile: string | undefined;
    if (adapter === 'xunit-v3') {
      const projectPick = await vscode.window.showOpenDialog({
        canSelectFiles:true, canSelectFolders:false, canSelectMany:false,
        defaultUri:vscode.Uri.file(frameworkRoot), openLabel:'Use xUnit project', filters:{ 'C# project':['csproj'] },
      });
      if (!projectPick?.length) return;
      projectFile = relativePathInside(frameworkRoot, projectPick[0].fsPath);
      if (projectFile === undefined) return void vscode.window.showErrorMessage('Feature Projection: xUnit projectFile must be inside frameworkProject.');
    } else {
      const configChoice: any = await vscode.window.showQuickPick([
        { label:'Automatic Vitest config discovery', value:'auto' },
        { label:'Choose Vitest config file…', value:'choose' },
      ], { placeHolder:'Vitest configuration' });
      if (!configChoice) return;
      if (configChoice.value === 'choose') {
        const configPick = await vscode.window.showOpenDialog({
          canSelectFiles:true, canSelectFolders:false, canSelectMany:false,
          defaultUri:vscode.Uri.file(frameworkRoot), openLabel:'Use Vitest config',
          filters:{ 'Vitest/Vite config':['ts','mts','cts','js','mjs','cjs'] },
        });
        if (!configPick?.length) return;
        configFile = relativePathInside(frameworkRoot, configPick[0].fsPath);
        if (configFile === undefined) return void vscode.window.showErrorMessage('Feature Projection: Vitest configFile must be inside frameworkProject.');
      }
    }

    const source: FeatureSourceConfig = { id:sourceId, role, root, adapter, frameworkProject, ...(projectFile ? {projectFile} : {}), ...(configFile ? {configFile} : {}) };
    const confirmation = await vscode.window.showInformationMessage(
      `Save FeatureSpace '${featureSpaceId}' source '${sourceId}' (${role}, ${adapter})?`,
      { modal:true }, 'Save',
    );
    if (confirmation !== 'Save') return;

    const result = await persistSourceConfiguration(folder, { featureSpaceId, source, replaceSourceId:existingSource?.id });
    if (!result.ok) {
      const blockingMessage = result.diagnostics.find((d:Diagnostic) => d.projectionImpact === 'blocks-part')?.message ?? 'Configuration is invalid.';
      const choice = await vscode.window.showErrorMessage(`Feature Projection: ${blockingMessage}`, 'Show Output');
      if (choice === 'Show Output') output.show(true);
      return result;
    }
    void vscode.window.showInformationMessage('Feature Projection configuration saved. Projection is Stale; run Feature Projection: Refresh when ready.');
    return result;
  };

  const isInside = (filePath: string, rootPath: string): boolean => {
    const file = path.resolve(filePath);
    const root = path.resolve(rootPath);
    const rel = path.relative(root, file);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  };

  const hasGeneratedSegment = (relativePath: string): boolean => {
    const parts: string[] = relativePath.split(path.sep).map((x: string) => x.toLowerCase()).filter(Boolean);
    return parts.some((x: string) => x === 'node_modules' || x === 'bin' || x === 'obj' || x === '.git');
  };

  const isInsideRelevantRoot = (filePath: string, rootPath: string): boolean => {
    if (!isInside(filePath, rootPath)) return false;
    return !hasGeneratedSegment(path.relative(rootPath, filePath));
  };

  const isRelevantUri = (uri: any): boolean => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder || uri.scheme !== 'file') return false;
    const config = getConfig();
    if (isPortableHtmlOutputPath(uri.fsPath,config.portableHtmlDirectory)) return false;
    for (const space of config.featureSpaces) {
      for (const source of space.sources ?? []) {
        if (!source?.root || !source?.frameworkProject) continue;
        const sourceRoot = path.resolve(folder.uri.fsPath, source.root);
        const frameworkRoot = path.resolve(folder.uri.fsPath, source.frameworkProject);
        if (isInsideRelevantRoot(uri.fsPath, sourceRoot) || isInsideRelevantRoot(uri.fsPath, frameworkRoot)) return true;
      }
    }
    return false;
  };

  const markStale = async (reason: string) => {
    log(`stale: ${reason}`);
    if (refreshing) {
      staleRequestedDuringRefresh = true;
      return;
    }
    const wasStale = uiState === 'stale';
    setState('stale', reason);
    if (!hasProjection || wasStale || stalePromptOpen) return;

    stalePromptOpen = true;
    try {
      const choice = await vscode.window.showInformationMessage(
        'Feature Projection is stale because relevant project files changed.',
        'Refresh',
      );
      if (choice === 'Refresh') await vscode.commands.executeCommand('featureProjection.refresh');
    } finally {
      stalePromptOpen = false;
    }
  };

  const disposeWatchers = () => {
    for (const watcher of fileWatchers) {
      try { watcher.dispose(); } catch { /* best effort */ }
    }
    fileWatchers = [];
  };

  const rebuildWatchers = () => {
    disposeWatchers();
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) return;
    const roots = new Set<string>();
    const config = getConfig();
    for (const space of config.featureSpaces) {
      for (const source of space.sources ?? []) {
        if (source?.root) roots.add(path.resolve(folder.uri.fsPath, source.root));
        if (source?.frameworkProject) roots.add(path.resolve(folder.uri.fsPath, source.frameworkProject));
      }
    }
    for (const root of roots) {
      const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(root, '**/*'));
      const onEvent = (uri: any, kind: 'change'|'create'|'delete') => {
        if (kind !== 'delete') {
          try {
            if (fs.statSync(uri.fsPath).isDirectory()) {
              log(`watcher ignored directory ${kind}: ${vscode.workspace.asRelativePath(uri)}`);
              return;
            }
          } catch { /* race: let relevance check decide */ }
        }
        if (isRelevantUri(uri)) void markStale(`Disk ${kind}: ${vscode.workspace.asRelativePath(uri)}`);
      };
      watcher.onDidChange((uri:any) => onEvent(uri, 'change'));
      watcher.onDidCreate((uri:any) => onEvent(uri, 'create'));
      watcher.onDidDelete((uri:any) => onEvent(uri, 'delete'));
      fileWatchers.push(watcher);
    }
    log(`watchers rebuilt: ${fileWatchers.length}`);
  };
  context.subscriptions.push({ dispose: disposeWatchers });

  const ensureDotnetWorker = async (config: PrototypeConfig): Promise<string> => {
    const workerDll = context.asAbsolutePath('workers/dotnet/runtime/FeatureProjection.DotNetWorker.dll');
    const needsDotnet = config.featureSpaces.some(space => (space.sources ?? []).some(source => source.adapter === 'xunit-v3'));
    if (!needsDotnet) return workerDll;
    if (fs.existsSync(workerDll)) {
      log(`.NET worker: packaged runtime ${workerDll}`);
      return workerDll;
    }

    // Development-source fallback only. Release VSIX packages the framework-dependent
    // worker artifact so normal users never need to compile extension-owned code.
    const project = context.asAbsolutePath('workers/dotnet/FeatureProjection.DotNetWorker.csproj');
    if (!fs.existsSync(project)) {
      throw new Error(`Packaged .NET worker is missing: ${workerDll}. Reinstall Feature Projection; the installed extension should contain workers/dotnet/runtime.`);
    }

    const runtimeDir = path.dirname(workerDll);
    fs.mkdirSync(runtimeDir, { recursive:true });
    const buildTimeout = config.buildTimeoutMs ?? 120000;
    log(`bootstrap(dev): packaged .NET worker missing; publishing ${project}`);
    const result = await runProcess('dotnet', ['publish', project, '-c', 'Release', '--no-self-contained', '--nologo', '-o', runtimeDir], context.extensionPath, buildTimeout, {
      label:'dotnet-worker-bootstrap',
      log,
    });
    if (!result.ok || !fs.existsSync(workerDll)) {
      const detail = result.stderr?.trim() || result.stdout?.trim() || result.error || 'unknown error';
      throw new Error(`Feature Projection could not prepare its .NET worker. A .NET 8 SDK/runtime is required for xUnit support. ${detail}`);
    }
    log(`bootstrap(dev): .NET worker published successfully`);
    return workerDll;
  };

  const refresh = async () => {
    if (refreshing) {
      log('refresh ignored: refresh already running');
      return;
    }
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      setState('error', 'Open a workspace before refreshing Feature Projection.');
      return vscode.window.showErrorMessage('Feature Projection: open a workspace first');
    }

    refreshing = true;
    staleRequestedDuringRefresh = false;
    setState('refreshing');
    log('------------------------------------------------------------');
    log(`refresh start: workspace=${folder.uri.fsPath} trusted=${vscode.workspace.isTrusted}`);

    try {
      const config = getConfig();
      const trusted = vscode.workspace.isTrusted;
      let dotnetWorkerDll = context.asAbsolutePath('workers/dotnet/runtime/FeatureProjection.DotNetWorker.dll');
      let vitestNodeRuntime: { command:string; env?:Record<string,string|undefined> } | undefined;
      if (trusted) {
        dotnetWorkerDll = await ensureDotnetWorker(config);
        const nodeRuntime = resolveExternalNodeRuntime(config.nodePath, process.env);
        const sanitizedNodeEnv = sanitizeExternalNodeEnvironment(process.env);
        vitestNodeRuntime = { command:nodeRuntime.command, env:sanitizedNodeEnv.env };
        log(`vitest node runtime: ${nodeRuntime.command} (${nodeRuntime.source})`);
        log(`vitest node environment: removed ${sanitizedNodeEnv.removed.length ? sanitizedNodeEnv.removed.join(', ') : 'none'}`);
      } else {
        log('workspace untrusted: project/runtime workers disabled');
      }
      const result = await runFullPrototype({
        workspaceRoot:folder.uri.fsPath,
        config,
        trusted,
        vitestWorkerPath:context.asAbsolutePath('workers/vitest-materialize.mjs'),
        dotnetWorkerDll,
        vitestNodeRuntime,
        log,
        onTiming: sample => log(`refresh-timing: phase=${sample.phase} durationMs=${sample.elapsedMs.toFixed(1)}` +
          (sample.sourceId ? ` featureSpace=${sample.featureSpaceId} source=${sample.sourceId}` : '')),
      });

      // A single JSON-compatible semantic document drives BOTH views.
      const projectionDocument = buildProjectionDocument(result.joined);
      const projection = renderProjection(projectionDocument.situations, { sourceHref: sourceDeepLink });
      lastMarkdown = projection.markdown;
      lastSourceActions = projection.sourceActions;
      lastAssertionSourceActions = projection.assertionSourceActions;
      lastSituationActions = projection.situationActions;
      publishDiagnostics(result.diagnostics);
      publishTestingTree(result.joined, result.definitions, result.diagnostics);
      emitter.fire(projectionUri);
      await show();
      hasProjection = true;

      const blocking = result.diagnostics.filter(d => d.projectionImpact === 'blocks-part');
      const sourceLess = result.diagnostics.filter(d => !d.source?.file);
      // Publish a complete, trusted snapshot only. Never silently replace
      // the previous HTML with restricted, blocked or stale evidence.
      if (trusted && blocking.length === 0 && !staleRequestedDuringRefresh) {
        try {
          const directory=resolvePortableHtmlDirectory(
            context.globalStorageUri.fsPath,folder.uri.fsPath,config.portableHtmlDirectory,
          );
          const html=renderPortableProjection(projectionDocument.situations,{
            sourceHref:sourceDeepLink,
          });
          const written=writePortableHtmlAtomic(directory,html);
          lastPortableHtmlFile=written.file;
          log(`portable-html: ${written.changed?'updated':'unchanged'} ${written.file}`);
        } catch(error:any) {
          log(`portable-html: not updated: ${error?.message ?? error}`);
          void vscode.window.showWarningMessage(
            `Feature Projection: HTML snapshot not updated: ${error?.message ?? error}`,
          );
        }
      } else {
        log('portable-html: not updated (untrusted, blocking or stale during Refresh)');
      }
      log(`refresh result: definitions=${result.definitions.length}; cases=${result.cases.length}; joined=${result.joined.length}; blocking=${blocking.length}; source-less diagnostics=${sourceLess.length}`);

      if (blocking.length) {
        setState('error', `${blocking.length} blocking diagnostic(s). Click to open Feature Projection output.`);
        void vscode.window.showErrorMessage(
          `Feature Projection: refresh completed with ${blocking.length} blocking diagnostic(s).`,
          'Show Output',
        ).then((choice:any) => { if (choice === 'Show Output') output.show(true); });
      } else if (staleRequestedDuringRefresh) {
        setState('stale', 'Relevant files changed while the refresh was running.');
      } else {
        setState('fresh', result.diagnostics.length ? `Projection is current with ${result.diagnostics.length} non-blocking diagnostic(s).` : 'Projection is up to date. Click to show it.');
        runSnapshot = {
          workspaceRoot:folder.uri.fsPath,config,
          joined:result.joined,definitions:result.definitions,cases:result.cases,
        };
        if (result.diagnostics.length) {
          void vscode.window.showWarningMessage(
            `Feature Projection: ${result.diagnostics.length} non-blocking diagnostic(s).`,
            'Show Output',
          ).then((choice:any) => { if (choice === 'Show Output') output.show(true); });
        }
      }
    } catch (err: any) {
      log(`refresh exception: ${err?.stack ?? err}`);
      setState('error', err?.message ?? String(err));
      void vscode.window.showErrorMessage(`Feature Projection failed: ${err?.message ?? err}`, 'Show Output')
        .then((choice:any) => { if (choice === 'Show Output') output.show(true); });
    } finally {
      refreshing = false;
    }
  };

  // 8.3b: explicitly invoked, trusted, read-only Roslyn registered-symbol usages.
  // This never refreshes the Projection, evaluates Configure(), or edits source.
  const queryRegisteredUsages = async (featureSpaceId: string, sourceId: string) => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!vscode.workspace.isTrusted) throw new Error('Registered C# usages require a trusted workspace.');
    if (!folder || vscode.workspace.workspaceFolders?.length !== 1) {
      throw new Error('Registered C# usages require exactly one open workspace folder.');
    }
    const config = getConfig();
    const validated = validatePrototypeConfig(config, folder.uri.fsPath);
    if (validated.diagnostics.some(d => d.projectionImpact === 'blocks-part')) {
      throw new Error('Feature Projection configuration has blocking diagnostics; fix configuration first.');
    }
    const selected = validated.valid.find(item =>
      item.spaceId === featureSpaceId && item.source.id === sourceId && item.source.adapter === 'xunit-v3'
    );
    if (!selected || typeof selected.source.projectFile !== 'string') {
      throw new Error('Unknown or invalid scoped C# source; usages refused.');
    }
    const source = selected.source;
    const projectRoot = path.resolve(folder.uri.fsPath, source.frameworkProject);
    const sourceRoot = path.resolve(folder.uri.fsPath, source.root);
    const projectFile = path.resolve(projectRoot, source.projectFile);
    const workspaceRoot = fs.realpathSync(folder.uri.fsPath);
    const realProjectRoot = fs.realpathSync(projectRoot);
    const realSourceRoot = fs.realpathSync(sourceRoot);
    const realProjectFile = fs.realpathSync(projectFile);
    const within = (root:string, candidate:string) => {
      const rel = path.relative(root,candidate);
      return rel === '' || (rel !== '..' && !rel.startsWith('..'+path.sep) && !path.isAbsolute(rel));
    };
    if (!within(workspaceRoot,realProjectRoot) || !within(realProjectRoot,realSourceRoot) ||
        !within(realProjectRoot,realProjectFile) || !realProjectFile.toLowerCase().endsWith('.csproj')) {
      throw new Error('Registered C# usage source/project escapes configured workspace scope.');
    }
    const dll = await ensureDotnetWorker(config);
    const input = {
      command:'probe-registered-usages',
      featureSpaceId, source:{
        id:source.id,role:source.role,adapter:source.adapter,
        root:realSourceRoot,frameworkProject:realProjectRoot,projectFile:realProjectFile,
      },
    };
    const result = await runJsonWorker<any>(
      'dotnet',[dll],input,folder.uri.fsPath,
      config.workerTimeoutMs ?? 30000,
      {label:`registered-usages:${featureSpaceId}/${sourceId}`,log},
    );
    if (!result.ok) throw new Error(`C# usage worker failed: ${result.error ?? 'unknown error'}`);
    return {
      featureSpaceId, sourceId, projectRoot:realProjectRoot,
      projectFile:realProjectFile, sourceRoot:realSourceRoot,
      workspaceRoot,
      result:normalizeRegisteredUsages(result.value,workspaceRoot,realProjectRoot),
    };
  };

  const showRegisteredUsages = async (selection?: {featureSpaceId:string; sourceId:string}) => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!vscode.workspace.isTrusted) {
      vscode.window.showWarningMessage('Feature Projection: registered C# usages require Workspace Trust.');
      return false;
    }
    if (!folder) {
      vscode.window.showWarningMessage('Feature Projection: open a workspace to inspect registered C# usages.');
      return false;
    }
    try {
      let chosen = selection;
      if (!chosen) {
        const config = getConfig();
        const sources = config.featureSpaces.flatMap(space =>
          (space.sources ?? []).filter(source => source.adapter === 'xunit-v3')
            .map(source => ({label:`${space.id} / ${source.id}`,
              description:`${source.role} · ${source.frameworkProject}`,
              featureSpaceId:space.id,sourceId:source.id})),
        );
        if (sources.length === 0) {
          vscode.window.showInformationMessage('Feature Projection: no configured xUnit C# sources.');
          return false;
        }
        const picked = await vscode.window.showQuickPick(sources, {
          placeHolder:'Select a FeatureSpace-qualified C# source (read-only symbol usage)',
          matchOnDescription:true,
        });
        if (!picked) return false;
        chosen = {featureSpaceId:picked.featureSpaceId,sourceId:picked.sourceId};
      }
      const response = await queryRegisteredUsages(chosen.featureSpaceId,chosen.sourceId);
      const rendered = renderRegisteredUsages(
        response.result,response.featureSpaceId,response.sourceId,response.projectRoot,sourceDeepLink,
      );
      const uri = registeredUsagesUri(response.featureSpaceId,response.sourceId);
      lastUsageMarkdown = rendered.markdown;
      lastUsageActions = rendered.actions;
      usageDocuments.set(uri.toString(),rendered);
      emitter.fire(uri);
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc,{preview:false});
      log(`registered-usages: view ${response.featureSpaceId}/${response.sourceId} targets=${response.result.targets.length} links=${rendered.actions.length} diagnostics=${response.result.diagnostics.length}`);
      if (response.result.diagnostics.length) {
        void vscode.window.showWarningMessage('Feature Projection: unresolved registrations; no partial usages shown. See Registered C# Usages.');
      }
      return true;
    } catch(err:any) {
      log(`registered-usages: refused or failed: ${err?.stack ?? err}`);
      vscode.window.showWarningMessage(`Feature Projection: registered C# usages unavailable: ${err?.message ?? err}`);
      return false;
    }
  };

  // P2/8.3d: explicitly invoked read-only Rename preview.
  // This UI has no mutation callback, no ApplyChanges and no WorkspaceEdit.
  const queryRegisteredRenamePreview = async (
    featureSpaceId:string, sourceId:string, symbol:string, newName:string,
  ) => {
    const scope = await queryRegisteredUsages(featureSpaceId,sourceId);
    if (!scope.result.targets.some(t => t.symbol === symbol))
      throw new Error('Only a uniquely registered method from this exact C# source may be previewed.');
    if (!newName.trim()) throw new Error('A nonempty proposed C# method name is required.');
    const inside = (root:string, file:string) => {
      const rel = path.relative(root,file);
      return rel === '' || (!path.isAbsolute(rel) &&
        rel !== '..' && !rel.startsWith('..'+path.sep));
    };
    const hasDirtyFile = () => vscode.workspace.textDocuments.some((doc:any) =>
      doc.isDirty && doc.uri.scheme === 'file' &&
      inside(scope.projectRoot,path.resolve(doc.uri.fsPath))
    );
    if (hasDirtyFile())
      throw new Error('Unsaved C# project documents exist. Save or discard edits before requesting a preview.');
    const input = {
      command:'probe-registered-rename',
      featureSpaceId, symbol, newName, source:{
        id:sourceId,role:'backend',adapter:'xunit-v3',
        root:scope.sourceRoot,frameworkProject:scope.projectRoot,projectFile:scope.projectFile,
      },
    };
    const config = getConfig();
    const result = await runJsonWorker<any>(
      'dotnet',[await ensureDotnetWorker(config)],input,scope.workspaceRoot,
      config.workerTimeoutMs ?? 30000,
      {label:`rename-preview:${featureSpaceId}/${sourceId}`,log},
    );
    if (!result.ok)
      throw new Error(`C# rename preview worker failed: ${result.error ?? 'unknown error'}`);
    if (hasDirtyFile())
      throw new Error('C# editor became dirty during Rename preview; please rerun.');
    return {scope,preview:normalizeRenamePreview(
      result.value,scope.workspaceRoot,scope.projectRoot,symbol,newName,
    )};
  };

  const showRegisteredRenamePreview = async (selection?: {
    featureSpaceId:string;sourceId:string;symbol:string;newName:string;
  }):Promise<boolean> => {
    if (!vscode.workspace.isTrusted || vscode.workspace.workspaceFolders?.length !== 1) {
      void vscode.window.showWarningMessage(
        'Feature Projection: C# Rename Preview requires exactly one trusted workspace folder.'
      );
      return false;
    }
    try {
      let chosen = selection;
      if (!chosen) {
        const cfg = getConfig();
        const choices = cfg.featureSpaces.flatMap(space =>
          (space.sources ?? []).filter(src => src.adapter === 'xunit-v3')
            .map(src => ({label:`${space.id} / ${src.id}`,
              description:`${src.role} · ${src.frameworkProject}`,
              spaceId:space.id,sourceId:src.id})),
        );
        if (!choices.length) {
          void vscode.window.showInformationMessage('Feature Projection: no registered xUnit sources.');
          return false;
        }
        const picked = await vscode.window.showQuickPick(choices,{
          placeHolder:'Select an exact FeatureSpace / C# source for read-only Rename preview',
        });
        if (!picked) return false;
        const usage = await queryRegisteredUsages(picked.spaceId,picked.sourceId);
        if (usage.result.diagnostics.length)
          throw new Error('Registered methods are ambiguous; Rename preview refused.');
        const method = await vscode.window.showQuickPick(
          usage.result.targets.map(t => ({
            label:t.symbol,description:t.kind, symbol:t.symbol,
          })),
          {placeHolder:'Choose the registered C# method (not an overload by name)'},
        );
        if (!method) return false;
        const newName = await vscode.window.showInputBox({
          title:'C# Rename Preview — no files will be changed',
          prompt:`Proposed name for ${method.symbol} (read-only preview)`,
          placeHolder:'NewMethodName',ignoreFocusOut:true,
        });
        if (!newName) return false;
        chosen = {featureSpaceId:picked.spaceId,sourceId:picked.sourceId,
          symbol:method.symbol,newName:newName.trim()};
      }
      const {scope,preview} = await queryRegisteredRenamePreview(
        chosen.featureSpaceId,chosen.sourceId,chosen.symbol,chosen.newName,
      );
      const rendered = renderRenamePreview(preview,scope.featureSpaceId,
        scope.sourceId,scope.projectRoot,sourceDeepLink);
      const uri = registeredRenameUri(scope.featureSpaceId,scope.sourceId,
        chosen.symbol,chosen.newName);
      renameDocuments.set(uri.toString(),rendered);
      emitter.fire(uri);
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc,{preview:false});
      log(`rename-preview: ${scope.featureSpaceId}/${scope.sourceId} ${chosen.symbol} -> ${chosen.newName}; accepted=${preview.accepted}; edits=${preview.edits.length}; read-only=true`);
      return true;
    } catch(err:any) {
      log(`rename-preview: refused: ${err?.stack ?? err}`);
      void vscode.window.showWarningMessage(
        `Feature Projection: C# Rename Preview unavailable: ${err?.message ?? err}`,
      );
      return false;
    }
  };

  context.subscriptions.push(vscode.commands.registerCommand('featureProjection.show', show));
  context.subscriptions.push(vscode.commands.registerCommand('featureProjection.refresh', refresh));
  context.subscriptions.push(vscode.commands.registerCommand('featureProjection.configure', configure));
  context.subscriptions.push(vscode.commands.registerCommand('featureProjection.showOutput', showOutput));
  context.subscriptions.push(vscode.commands.registerCommand('featureProjection.openPortableHtml', openPortableHtml));
  context.subscriptions.push(vscode.commands.registerCommand('featureProjection.showRegisteredUsages', () => showRegisteredUsages()));
  // D-062: Rename Preview is research-only, excluded from public MVP commands.
  // Its read-only implementation remains available only via isolated test hooks.
  context.subscriptions.push(vscode.commands.registerCommand('featureProjection.openSource', openSource));
  context.subscriptions.push(vscode.commands.registerCommand('featureProjection.revealSituationInTestExplorer', revealSituationInTestExplorer));
  context.subscriptions.push(vscode.commands.registerCommand('featureProjection.openSituationInProjection', openSituationInProjection));
  if (isFeatureProjectionTestMode()) {
    context.subscriptions.push(vscode.commands.registerCommand('featureProjection.__configureTest', async (change: SourceConfigurationChange) => {
      const folder = configureWorkspaceFolder(false);
      if (!folder) return { ok:false, diagnostics:[], persisted:false, error:'Configure requires exactly one workspace folder.' };
      return await persistSourceConfiguration(folder, change);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('featureProjection.__registeredUsageResult', async (spaceId:string,sourceId:string) =>
      await queryRegisteredUsages(spaceId,sourceId)));
    context.subscriptions.push(vscode.commands.registerCommand('featureProjection.__showRegisteredUsages', async (spaceId:string,sourceId:string) =>
      await showRegisteredUsages({featureSpaceId:spaceId,sourceId})));
    context.subscriptions.push(vscode.commands.registerCommand('featureProjection.__registeredRenamePreviewResult',
      async (spaceId:string,sourceId:string,symbol:string,newName:string) =>
        await queryRegisteredRenamePreview(spaceId,sourceId,symbol,newName)));
    context.subscriptions.push(vscode.commands.registerCommand('featureProjection.__showRegisteredRenamePreview',
      async (spaceId:string,sourceId:string,symbol:string,newName:string) =>
        await showRegisteredRenamePreview({featureSpaceId:spaceId,sourceId,symbol,newName})));
    context.subscriptions.push(vscode.commands.registerCommand('featureProjection.__debugState', () => ({
      usageMarkdown:lastUsageMarkdown,
      portableHtmlFile:lastPortableHtmlFile,
      usageActions:lastUsageActions,
      uiState,
      hasProjection,
      refreshing,
      markdown:lastMarkdown,
      sourceActions:lastSourceActions,
      assertionSourceActions:lastAssertionSourceActions,
      situationActions:lastSituationActions,
      diagnostics:lastDiagnostics,
      testingTree:lastTestingTree,
    })));
    log('automation test mode enabled: hidden test commands registered');
  }

  // A direct editor save is cheap to observe and gives immediate feedback. FileSystemWatcher below
  // additionally catches changes made by git, generators, other editors, and external tools.
  context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((doc: any) => {
    if (isRelevantUri(doc.uri)) void markStale(`Saved ${vscode.workspace.asRelativePath(doc.uri)}`);
  }));
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event: any) => {
    if (event.affectsConfiguration('featureProjection')) {
      rebuildWatchers();
      void markStale('Feature Projection configuration changed');
    }
  }));
  if (vscode.workspace.onDidGrantWorkspaceTrust) {
    context.subscriptions.push(vscode.workspace.onDidGrantWorkspaceTrust(() => {
      void markStale('Workspace trust changed; framework materialization can now be refreshed');
    }));
  }

  // P4 first slice: explicit single Frontend Situation, never Run All/Backend.
  const runFrontendSituation = async (request:any, token:any) => {
    const run = testController.createTestRun(request);
    const abort=new AbortController();
    const cancellation=token.onCancellationRequested(()=>abort.abort());
    if(token.isCancellationRequested)abort.abort();
    const selected = request.include?.[0];
    const refused = (reason:string) => {
      log(`p4 frontend refused: ${reason}`);
      if (selected) run.errored(selected,[new vscode.TestMessage(reason)]);
      else void vscode.window.showWarningMessage(`Feature Projection: ${reason}`);
    };
    try {
      if (request.include?.length !== 1 || (request.exclude?.length ?? 0) !== 0 || !selected) {
        refused('select exactly one Frontend part; Run All/group selection is not supported');
        return;
      }
      const situationId = selected.id.endsWith('/frontend')
        ? selected.id.slice(0,-'/frontend'.length) : selected.id;
      if (!situationTestItems.has(situationId) || !runSnapshot ||
          uiState !== 'fresh' || refreshing || !vscode.workspace.isTrusted ||
          vscode.workspace.workspaceFolders?.length !== 1 ||
          vscode.workspace.workspaceFolders[0].uri.fsPath !== runSnapshot.workspaceRoot) {
        refused('requires one published Fresh Situation in a trusted single-folder workspace');
        return;
      }
      if(abort.signal.aborted){run.skipped(selected);return;}
      const snapshot=runSnapshot;
      if (JSON.stringify(getConfig())!==JSON.stringify(snapshot.config))
        throw new Error('configuration changed since Refresh');
      const dirty=vscode.workspace.textDocuments.some((doc:any)=>
        doc.isDirty && doc.uri.scheme==='file');
      const plan=planVitestSituationRun({
        workspaceRoot:snapshot.workspaceRoot,config:snapshot.config,
        joined:snapshot.joined,definitions:snapshot.definitions,
        cases:snapshot.cases,situationId,role:'frontend',
        trusted:vscode.workspace.isTrusted,fresh:uiState==='fresh',
        dirtyFilesKnownClean:!dirty,
      });
      run.started(selected);
      const node=resolveExternalNodeRuntime(snapshot.config.nodePath,process.env);
      const env=sanitizeExternalNodeEnvironment(process.env).env;
      const result=await runExactVitestSituation(plan,
        context.asAbsolutePath('workers/vitest-materialize.mjs'),
        Math.min(120000,Math.max(30000,snapshot.config.workerTimeoutMs??30000)),
        {command:node.command,env},log,abort.signal);
      if(abort.signal.aborted){run.skipped(selected);}
      else if (uiState!=='fresh' || refreshing || runSnapshot!==snapshot ||
          !vscode.workspace.isTrusted ||
          vscode.workspace.textDocuments.some((doc:any)=>
            doc.isDirty && doc.uri.scheme==='file')) {
        refused('source/trust/editor state changed during the test run');
      } else if (result.status==='passed') {
        run.passed(selected);
      } else if (result.status==='failed') {
        run.failed(selected,[new vscode.TestMessage(result.message)]);
      } else { refused(result.message); }
      log(`p4 frontend result: ${result.status} executed=${result.executed}`);
    } catch (err:any) {
      refused(err?.message ?? String(err));
    } finally { cancellation.dispose();run.end(); }
  };
  context.subscriptions.push(testController.createRunProfile(
    'Run Frontend Situation',vscode.TestRunProfileKind.Run,runFrontendSituation,false,frontendTag));
  // P4.3: exact Backend Fact or uniquely pre-enumerated Theory row.
  // Folded Theory rows fail closed before executing any tests.
  const runBackendFact = async (request:any,token:any) => {
    const run=testController.createTestRun(request);
    const abort=new AbortController();
    const cancellation=token.onCancellationRequested(()=>abort.abort());
    if(token.isCancellationRequested)abort.abort();
    const selected=request.include?.[0];
    const refused=(reason:string)=>{
      log('p4 backend refused: '+reason);
      if(selected) run.errored(selected,[new vscode.TestMessage(reason)]);
      else void vscode.window.showWarningMessage('Feature Projection: '+reason);
    };
    try {
      if(request.include?.length!==1||(request.exclude?.length??0)!==0||
        !selected||!selected.id.endsWith('/backend')) {
        refused('select exactly one Backend part; Run All/group selection is not supported');
        return;
      }
      const situationId=selected.id.slice(0,-'/backend'.length);
      if(!situationTestItems.has(situationId)||!runSnapshot||
         uiState!=='fresh'||refreshing||!vscode.workspace.isTrusted||
         vscode.workspace.workspaceFolders?.length!==1||
         vscode.workspace.workspaceFolders[0].uri.fsPath!==runSnapshot.workspaceRoot){
        refused('requires one published Fresh Backend Situation in a trusted single-folder workspace');
        return;
      }
      if(abort.signal.aborted){run.skipped(selected);return;}
      const snapshot=runSnapshot;
      if(JSON.stringify(getConfig())!==JSON.stringify(snapshot.config))
        throw Error('configuration changed since Refresh');
      const dirty=()=>vscode.workspace.textDocuments.some((doc:any)=>
        doc.isDirty&&doc.uri.scheme==='file');
      const plan=planXunitBackendRun({
        workspaceRoot:snapshot.workspaceRoot,config:snapshot.config,
        joined:snapshot.joined,definitions:snapshot.definitions,cases:snapshot.cases,
        situationId,role:'backend',trusted:vscode.workspace.isTrusted,
        fresh:uiState==='fresh',dirtyFilesKnownClean:!dirty(),
      });
      run.started(selected);
      const result=await runExactXunitFact(plan,
        Math.min(600000,Math.max(30000,snapshot.config.buildTimeoutMs??120000)),
        Math.min(120000,Math.max(30000,snapshot.config.workerTimeoutMs??30000)),
        log,abort.signal);
      if(abort.signal.aborted){run.skipped(selected);}
      else if(uiState!=='fresh'||refreshing||runSnapshot!==snapshot||
         !vscode.workspace.isTrusted||dirty()||
         JSON.stringify(getConfig())!==JSON.stringify(snapshot.config)){
        refused('source/trust/editor/config changed during Backend test run');
      }else if(result.status==='passed'){run.passed(selected);}
      else if(result.status==='failed'){
        run.failed(selected,[new vscode.TestMessage(result.message)]);
      }else{refused(result.message);}
      log(`p4 backend result: ${result.status} executed=${result.executed}`);
    }catch(err:any){refused(err?.message??String(err));}
    finally{cancellation.dispose();run.end();}
  };
  context.subscriptions.push(testController.createRunProfile(
    'Run Backend Situation',vscode.TestRunProfileKind.Run,runBackendFact,false,backendTag));
  // P4.4: one complete Situation, never a Feature/Outcome/Run All group.
  // Preflight both targets before executing ANY user test.
  let runBothActive=false;
  const runBothSituation=async(request:any,token:any)=>{
    const run=testController.createTestRun(request);
    const abort=new AbortController();
    const cancellation=token.onCancellationRequested(()=>abort.abort());
    if(token.isCancellationRequested)abort.abort();
    const selected=request.include?.[0];
    const refuse=(message:string)=>{
      log('p4 both refused: '+message);
      if(selected) run.errored(selected,[new vscode.TestMessage(message)]);
      else void vscode.window.showWarningMessage('Feature Projection: '+message);
    };
    let ownsLock=false;
    try {
      if(runBothActive){
        refuse('another Run Both is already active');return;
      }
      if(request.include?.length!==1||(request.exclude?.length??0)!==0||
         !selected||situationTestItems.get(selected.id)!==selected){
        refuse('select exactly one Situation node, not a parent group or part');return;
      }
      if(!runSnapshot||uiState!=='fresh'||refreshing||!vscode.workspace.isTrusted||
         vscode.workspace.workspaceFolders?.length!==1||
         vscode.workspace.workspaceFolders[0].uri.fsPath!==runSnapshot.workspaceRoot){
        refuse('requires one published Fresh Situation in a trusted single-folder workspace');return;
      }
      const snapshot=runSnapshot;
      const dirty=()=>vscode.workspace.textDocuments.some((doc:any)=>
        doc.isDirty&&doc.uri.scheme==='file');
      const valid=()=>ownsLock&&!abort.signal.aborted&&
        uiState==='fresh'&&!refreshing&&runSnapshot===snapshot&&
        vscode.workspace.isTrusted&&!dirty()&&
        vscode.workspace.workspaceFolders?.length===1&&
        vscode.workspace.workspaceFolders[0].uri.fsPath===snapshot.workspaceRoot&&
        JSON.stringify(getConfig())===JSON.stringify(snapshot.config);
      if(abort.signal.aborted){run.skipped(selected);return;}
      if(dirty()||JSON.stringify(getConfig())!==JSON.stringify(snapshot.config)){
        refuse('dirty files or changed configuration');return;
      }
      const plan=planRunBoth({
        workspaceRoot:snapshot.workspaceRoot,config:snapshot.config,
        joined:snapshot.joined,definitions:snapshot.definitions,
        cases:snapshot.cases,situationId:selected.id,
        trusted:vscode.workspace.isTrusted,fresh:uiState==='fresh',
        dirtyFilesKnownClean:!dirty(),
      });
      const frontItem=selected.children.get(selected.id+'/frontend');
      const backItem=selected.children.get(selected.id+'/backend');
      if(!frontItem||!backItem){
        refuse('complete Frontend/Backend test items not found');return;
      }
      runBothActive=true;ownsLock=true;
      run.started(selected);
      const node=resolveExternalNodeRuntime(snapshot.config.nodePath,process.env);
      const env=sanitizeExternalNodeEnvironment(process.env).env;
      const child=(stage:'frontend'|'backend')=>
        stage==='frontend'?frontItem:backItem;
      const outcome=await executeRunBoth(plan,{
        valid,
        preflightTheory:target=>inspectExactXunitCase(target,
          Math.min(600000,Math.max(30000,snapshot.config.buildTimeoutMs??120000)),
          Math.min(120000,Math.max(30000,snapshot.config.workerTimeoutMs??30000)),
          log,abort.signal),
        frontend:target=>runExactVitestSituation(target,
          context.asAbsolutePath('workers/vitest-materialize.mjs'),
          Math.min(120000,Math.max(30000,snapshot.config.workerTimeoutMs??30000)),
          {command:node.command,env},log,abort.signal),
        backend:(target,proof)=>runExactXunitFact(target,
          Math.min(600000,Math.max(30000,snapshot.config.buildTimeoutMs??120000)),
          Math.min(120000,Math.max(30000,snapshot.config.workerTimeoutMs??30000)),
          log,abort.signal,proof),
        started:stage=>run.started(child(stage)),
        finished:(stage,result)=>{
          const item=child(stage);
          if(abort.signal.aborted)run.skipped(item);
          else if(!valid()) run.errored(item,[new vscode.TestMessage('State changed during test')]);
          else if(result.status==='passed') run.passed(item);
          else if(result.status==='failed')
            run.failed(item,[new vscode.TestMessage(result.message)]);
          else run.errored(item,[new vscode.TestMessage(result.message)]);
        },
      });
      if(!outcome.frontend)run.skipped(frontItem);
      if(!outcome.backend)run.skipped(backItem);
      if(abort.signal.aborted)run.skipped(selected);
      else if(outcome.status==='passed')run.passed(selected);
      else if(outcome.status==='failed')
        run.failed(selected,[new vscode.TestMessage(outcome.message)]);
      else refuse(outcome.message);
      log('p4 both result: '+outcome.status+
        ' frontend='+outcome.frontend?.status+' backend='+outcome.backend?.status);
    }catch(err:any){refuse(err?.message??String(err));}
    finally{cancellation.dispose();if(ownsLock)runBothActive=false;run.end();}
  };
  context.subscriptions.push(testController.createRunProfile(
    'Run Both Situation',vscode.TestRunProfileKind.Run,runBothSituation,false));
  rebuildWatchers();
}

export function deactivate() {}
