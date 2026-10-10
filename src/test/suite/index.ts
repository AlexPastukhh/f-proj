import assert = require('node:assert/strict');
import fs = require('node:fs');
import path = require('node:path');
import vscode = require('vscode');

async function waitFor<T>(read: () => Promise<T> | T, predicate: (value:T) => boolean, timeoutMs = 180000): Promise<T> {
  const start = Date.now();
  let last = await read();
  while (!predicate(last)) {
    if (Date.now() - start > timeoutMs)
      throw new Error(`Timed out waiting for Extension Host state; last=${JSON.stringify(last)}`);
    await new Promise(resolve => setTimeout(resolve, 250));
    last = await read();
  }
  return last;
}

async function debugState(): Promise<any> {
  return await vscode.commands.executeCommand('featureProjection.__debugState');
}

function configuredSpaces(folder: vscode.WorkspaceFolder): any[] {
  return vscode.workspace.getConfiguration('featureProjection', folder.uri).get('featureSpaces') ?? [];
}

function writeResult(payload: any): void {
  if (process.env.FEATURE_PROJECTION_SMOKE_RESULT)
    fs.writeFileSync(process.env.FEATURE_PROJECTION_SMOKE_RESULT, JSON.stringify(payload, null, 2), 'utf8');
}

function expectedSourceHref(source: any): string {
  const normalized = source.file.replace(/\\/g, '/');
  const absolute = normalized.startsWith('/') ? normalized : `/${normalized}`;
  const encodedPath = absolute.split('/').map((segment:string) => /^[A-Za-z]:$/.test(segment) ? segment : encodeURIComponent(segment)).join('/');
  return `${vscode.env.uriScheme}://file${encodedPath}:${source.line}:${source.column}`;
}

function flattenTestingTree(nodes: any[]): any[] {
  return nodes.flatMap(node => [node, ...flattenTestingTree(node.children ?? [])]);
}

function assertWorkspaceSource(source: any, folder: vscode.WorkspaceFolder, extension: any): void {
  const file = path.resolve(source.file).toLowerCase();
  const workspace = path.resolve(folder.uri.fsPath).toLowerCase();
  const extensionRoot = path.resolve(extension.extensionPath).toLowerCase();
  assert.ok(file === workspace || file.startsWith(`${workspace}${path.sep}`), `source must stay inside workspace: ${source.file}`);
  if (process.env.FEATURE_PROJECTION_EXPECTED_EXTENSION_ROOT) {
    assert.ok(!(file === extensionRoot || file.startsWith(`${extensionRoot}${path.sep}`)), `source must not point into installed extension: ${source.file}`);
  }
}

async function assertProjectionOpenSource(action: any): Promise<void> {
  await vscode.commands.executeCommand('featureProjection.openSource', action.source);
  const editor = vscode.window.activeTextEditor;
  assert.ok(editor, `source navigation did not open an editor for ${action.source.file}`);
  assert.equal(path.resolve(editor.document.uri.fsPath).toLowerCase(), path.resolve(action.source.file).toLowerCase());
  assert.equal(editor.selection.active.line, action.source.line - 1);
}

async function runNormalHooks(folder: vscode.WorkspaceFolder, extension: any): Promise<void> {
  const commands = await vscode.commands.getCommands(true);
  for (const publicCommand of ['featureProjection.show','featureProjection.configure','featureProjection.refresh','featureProjection.showOutput'])
    assert.ok(commands.includes(publicCommand), `public command must remain registered: ${publicCommand}`);
  assert.ok(!commands.includes('featureProjection.__configureTest'), 'normal installed session must not register __configureTest');
  assert.ok(!commands.includes('featureProjection.__debugState'), 'normal installed session must not register __debugState');
  assert.ok(!commands.includes('featureProjection.__registeredUsageResult'), 'normal installed session must not register hidden usage probe');
  assert.ok(!commands.includes('featureProjection.__showRegisteredUsages'), 'normal installed session must not register hidden usage view action');
  assert.ok(!commands.includes('featureProjection.__registeredRenamePreviewResult'), 'normal installed session must not register hidden rename preview query');
  assert.ok(!commands.includes('featureProjection.__showRegisteredRenamePreview'), 'normal installed session must not register hidden rename preview editor action');
  assert.ok(commands.includes('featureProjection.previewRegisteredRename'), 'public read-only Rename Preview must be registered');
  writeResult({
    ok:true,
    mode:'normal-hooks',
    trusted:vscode.workspace.isTrusted,
    version:extension.packageJSON.version,
    extensionPath:extension.extensionPath,
    hiddenCommandsAbsent:true,
  });
}

async function runPrerequisite(folder: vscode.WorkspaceFolder, extension: any, kind: 'node'|'dotnet'): Promise<void> {
  assert.equal(vscode.workspace.isTrusted, true, 'prerequisite smoke must run trusted');
  await vscode.commands.executeCommand('featureProjection.refresh');
  const settled = await waitFor(debugState, state => state && !state.refreshing);
  const expectedRule = kind === 'node' ? 'worker/node-runtime-missing' : 'worker/dotnet-prerequisite-unavailable';
  const diagnostic = (settled.diagnostics ?? []).find((d:any) => d.ruleId === expectedRule);
  assert.ok(diagnostic, `missing prerequisite diagnostic ${expectedRule}: ${JSON.stringify(settled.diagnostics)}`);
  assert.equal(diagnostic.projectionImpact, 'blocks-part');
  assert.equal(settled.uiState, 'error');
  if (kind === 'node') assert.match(diagnostic.message, /featureProjection\.nodePath/);
  else assert.match(diagnostic.message, /compatible \.NET SDK\/runtime/);
  writeResult({
    ok:true,
    mode:`prerequisite-${kind}`,
    trusted:vscode.workspace.isTrusted,
    version:extension.packageJSON.version,
    extensionPath:extension.extensionPath,
    ruleId:diagnostic.ruleId,
    message:diagnostic.message,
    uiState:settled.uiState,
  });
}

async function runUntrusted(folder: vscode.WorkspaceFolder, extension: any): Promise<void> {
  assert.equal(vscode.workspace.isTrusted, false, 'untrusted smoke must run in Restricted Mode');
  const spaces = configuredSpaces(folder);
  assert.equal(spaces.length, 1, 'untrusted smoke expects one configured FeatureSpace');
  assert.deepEqual(spaces[0].sources.map((x:any) => x.id), ['frontend','backend']);

  await vscode.commands.executeCommand('featureProjection.refresh');
  const settled = await waitFor(debugState, state => state && !state.refreshing);
  const ruleIds = (settled.diagnostics ?? []).map((d:any) => d.ruleId);
  assert.equal(settled.hasProjection, true, 'untrusted Refresh must publish explicit partial projection');
  assert.equal(settled.uiState, 'error', 'blocked project/runtime evidence must not look Fresh');
  assert.ok(ruleIds.includes('worker/untrusted-workspace'), 'Vitest runtime evidence must be blocked explicitly');
  assert.ok(ruleIds.includes('worker/untrusted-project-analysis'), 'C# Roslyn/MSBuild evidence must be blocked explicitly');
  assert.ok(!ruleIds.includes('worker/dotnet-worker-missing'), 'Restricted Mode must not require the packaged .NET worker');
  assert.match(settled.markdown, /Situation: refresh_token_expired/);
  assert.match(settled.markdown, /Backend: \[unmatched\]/);
  assert.equal(await vscode.commands.executeCommand('featureProjection.previewRegisteredRename'),false,
    'read-only Rename preview must refuse Restricted Mode');
  await assert.rejects(
    vscode.commands.executeCommand('featureProjection.__registeredRenamePreviewResult',
      'app','backend','User.Authenticate(string)','SomeNewName'),
    /trusted workspace/
  );

  writeResult({
    ok:true,
    mode:'untrusted',
    trusted:vscode.workspace.isTrusted,
    version:extension.packageJSON.version,
    extensionPath:extension.extensionPath,
    ruleIds,
    uiState:settled.uiState,
  });
}

async function runTrusted(folder: vscode.WorkspaceFolder, extension: any): Promise<void> {
  assert.equal(vscode.workspace.isTrusted, true, 'trusted smoke run must be trusted');
  const commands = await vscode.commands.getCommands(true);
  assert.ok(commands.includes('featureProjection.configure'), 'public Configure command must be registered');
  assert.deepEqual(configuredSpaces(folder), [], 'Configure smoke workspace must start without Feature Projection featureSpaces');

  const invalid:any = await vscode.commands.executeCommand('featureProjection.__configureTest', {
    featureSpaceId:'app',
    source:{ id:'invalid', role:'frontend', root:'missing/features', adapter:'vitest-5', frameworkProject:'frontend' },
  });
  assert.equal(invalid.ok, false, 'invalid Configure draft must fail');
  assert.equal(invalid.persisted, false, 'invalid Configure draft must not persist');
  assert.ok(invalid.diagnostics.some((d:any) => d.ruleId === 'feature-projection/source-root-missing'));
  assert.deepEqual(configuredSpaces(folder), [], 'invalid Configure draft must leave settings unchanged');
  assert.equal((await debugState()).hasProjection, false, 'Configure validation must not run projection/framework materialization');

  const frontend:any = await vscode.commands.executeCommand('featureProjection.__configureTest', {
    featureSpaceId:'app',
    source:{ id:'frontend', role:'frontend', root:'frontend/src/features', adapter:'vitest-5', frameworkProject:'frontend', configFile:'vitest.config.ts' },
  });
  assert.equal(frontend.ok, true, `frontend Configure failed: ${JSON.stringify(frontend.diagnostics)}`);
  assert.equal(frontend.persisted, true);
  const afterFrontend = await debugState();
  assert.equal(afterFrontend.uiState, 'stale', 'Configure must leave projection Stale');
  assert.equal(afterFrontend.hasProjection, false, 'Configure must not auto-Refresh');

  const backend:any = await vscode.commands.executeCommand('featureProjection.__configureTest', {
    featureSpaceId:'app',
    source:{ id:'backend', role:'backend', root:'backend/Features', adapter:'xunit-v3', frameworkProject:'backend', projectFile:'Backend.FeatureTests.csproj' },
  });
  assert.equal(backend.ok, true, `backend Configure failed: ${JSON.stringify(backend.diagnostics)}`);
  assert.equal(backend.persisted, true);

  const persisted = configuredSpaces(folder);
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].id, 'app');
  assert.deepEqual(persisted[0].sources.map((x:any) => x.id), ['frontend','backend']);
  assert.equal(persisted[0].sources[0].configFile, 'vitest.config.ts');
  assert.equal(persisted[0].sources[1].projectFile, 'Backend.FeatureTests.csproj');

  await vscode.commands.executeCommand('featureProjection.refresh');
  const settled = await waitFor(debugState, state => state && !state.refreshing);
  if (settled.uiState !== 'fresh') {
    const blocking = (settled.diagnostics ?? []).filter((d:any) => d.projectionImpact === 'blocks-part');
    throw new Error(`Refresh did not become fresh: state=${settled.uiState}; blocking=${JSON.stringify(blocking)}`);
  }
  assert.match(settled.markdown, /Situation: passwords_dont_match/);
  assert.match(settled.markdown, /Situation: email_has_invalid_format/);
  assert.match(settled.markdown, /Situation: refresh_token_expired/);
  assert.equal(settled.diagnostics.filter((d:any) => d.projectionImpact === 'blocks-part').length, 0);
  assert.equal(settled.testingTree.length, 1);

  const sourceActions = settled.sourceActions ?? [];
  assert.equal(sourceActions.length, 6, 'three joined Situations must expose Frontend + Backend source actions');
  for (const action of sourceActions) {
    assertWorkspaceSource(action.source, folder, extension);
    const roleLabel = action.role === 'frontend' ? 'Frontend' : 'Backend';
    const linkLabel = `${roleLabel} · ${path.basename(action.source.file)}:${action.source.line}`;
    const href = expectedSourceHref(action.source);
    assert.ok(settled.markdown.includes(`[${linkLabel}](${href})`), `projection Markdown must contain native source link ${href}`);
  }

  const testingParts = flattenTestingTree(settled.testingTree).filter((node:any) => node.kind === 'part' && node.source);
  assert.equal(testingParts.length, 6, 'Testing API must expose Frontend + Backend source nodes for all joined Situations');
  for (const node of testingParts) assertWorkspaceSource(node.source, folder, extension);

  const frontendAction = sourceActions.find((action:any) => action.role === 'frontend');
  const backendAction = sourceActions.find((action:any) => action.role === 'backend');
  assert.ok(frontendAction && backendAction, 'projection must expose both Frontend and Backend navigation actions');
  await assertProjectionOpenSource(frontendAction);
  await assertProjectionOpenSource(backendAction);

  const target = path.join(folder.uri.fsPath, 'frontend', 'src', 'features', 'login', 'login.feature.test.ts');
  const original = fs.readFileSync(target, 'utf8');
  try {
    fs.writeFileSync(target, `${original}\n// feature-projection-extension-smoke-touch\n`, 'utf8');
    const stale = await waitFor(debugState, state => state?.uiState === 'stale', 15000);
    assert.equal(stale.uiState, 'stale');
  } finally {
    fs.writeFileSync(target, original, 'utf8');
  }

  writeResult({
    ok:true,
    mode:'trusted',
    trusted:vscode.workspace.isTrusted,
    version:extension.packageJSON.version,
    extensionPath:extension.extensionPath,
    configured:true,
    situations:['passwords_dont_match','email_has_invalid_format','refresh_token_expired'],
    finalState:'stale',
  });
}

function markdownScope(markdown: string, scope: string): string {
  const marker = `Scope: ${scope}`;
  const start = markdown.indexOf(marker);
  assert.ok(start >= 0, `projection must contain scope ${scope}`);
  const next = markdown.indexOf('\n## Feature:', start + marker.length);
  return markdown.slice(start, next >= 0 ? next : markdown.length);
}

async function runScopeIsolation(folder: vscode.WorkspaceFolder, extension: any): Promise<void> {
  assert.equal(vscode.workspace.isTrusted, true, 'scope-isolation smoke must run trusted');
  assert.deepEqual(configuredSpaces(folder), [], 'scope-isolation workspace must start from empty Feature Projection settings');

  const changes = [
    { featureSpaceId:'accounts', source:{ id:'frontend', role:'frontend', root:'apps/account-web/spec/feature-tests', adapter:'vitest-5', frameworkProject:'apps/account-web' } },
    { featureSpaceId:'accounts', source:{ id:'backend', role:'backend', root:'services/account-api/Features', adapter:'xunit-v3', frameworkProject:'services/account-api', projectFile:'Account.Api.FeatureTests.csproj' } },
    { featureSpaceId:'billing', source:{ id:'frontend', role:'frontend', root:'apps/billing-web/spec/feature-tests', adapter:'vitest-5', frameworkProject:'apps/billing-web' } },
    { featureSpaceId:'billing', source:{ id:'backend', role:'backend', root:'services/billing-api/Features', adapter:'xunit-v3', frameworkProject:'services/billing-api', projectFile:'Billing.Api.FeatureTests.csproj' } },
  ];
  for (const change of changes) {
    const result:any = await vscode.commands.executeCommand('featureProjection.__configureTest', change);
    assert.equal(result.ok, true, `scope Configure failed: ${JSON.stringify(result.diagnostics)}`);
    assert.equal(result.persisted, true, 'scope Configure must persist each valid source');
  }

  const persisted = configuredSpaces(folder);
  assert.deepEqual(persisted.map((space:any) => space.id), ['accounts','billing']);
  assert.deepEqual(persisted[0].sources.map((source:any) => source.id), ['frontend','backend']);
  assert.deepEqual(persisted[1].sources.map((source:any) => source.id), ['frontend','backend']);
  const beforeRefresh = await debugState();
  assert.equal(beforeRefresh.hasProjection, false, 'Configure must not auto-Refresh second workspace');
  assert.equal(beforeRefresh.uiState, 'stale');

  await vscode.commands.executeCommand('featureProjection.refresh');
  const settled = await waitFor(debugState, state => state && !state.refreshing);
  const blocking = (settled.diagnostics ?? []).filter((d:any) => d.projectionImpact === 'blocks-part');
  assert.equal(settled.uiState, 'fresh', `second workspace must become Fresh; blocking=${JSON.stringify(blocking)}`);
  assert.equal(blocking.length, 0, `second workspace has blocking diagnostics: ${JSON.stringify(blocking)}`);

  const situationCount = (settled.markdown.match(/^Situation: /gm) ?? []).length;
  assert.equal(situationCount, 6, 'second workspace must emit exactly six scoped Situations');
  assert.equal((settled.sourceActions ?? []).length, 10, 'four paired parameterized rows plus two unmatched parts must expose ten source actions');

  const accountsShared = markdownScope(settled.markdown, 'accounts/shared');
  assert.match(accountsShared, /Situation: expired/);
  assert.match(accountsShared, /Situation: locked/);
  assert.match(accountsShared, /account_ui_stays_blocked/);
  assert.match(accountsShared, /account_request_is_rejected/);
  assert.doesNotMatch(accountsShared, /billing_ui_stays_blocked|billing_request_is_rejected/);

  const billingShared = markdownScope(settled.markdown, 'billing/shared');
  assert.match(billingShared, /Situation: expired/);
  assert.match(billingShared, /Situation: locked/);
  assert.match(billingShared, /billing_ui_stays_blocked/);
  assert.match(billingShared, /billing_request_is_rejected/);
  assert.doesNotMatch(billingShared, /account_ui_stays_blocked|account_request_is_rejected/);

  const accountsOrphan = markdownScope(settled.markdown, 'accounts/orphan');
  assert.match(accountsOrphan, /Situation: manual_review/);
  assert.match(accountsOrphan, /account_ui_waits_for_review/);
  assert.match(accountsOrphan, /#### Backend: \[unmatched\]/);
  assert.doesNotMatch(accountsOrphan, /billing_server_records_pending_review/);

  const billingOrphan = markdownScope(settled.markdown, 'billing/orphan');
  assert.match(billingOrphan, /Situation: manual_review/);
  assert.match(billingOrphan, /#### Frontend: \[unmatched\]/);
  assert.match(billingOrphan, /billing_server_records_pending_review/);
  assert.doesNotMatch(billingOrphan, /account_ui_waits_for_review/);

  const flatTree = flattenTestingTree(settled.testingTree ?? []);
  assert.equal(flatTree.filter((node:any) => node.kind === 'situation').length, 6);
  const partNodes = flatTree.filter((node:any) => node.kind === 'part');
  assert.equal(partNodes.length, 12, 'Testing API must show both roles including two explicit unmatched nodes');
  assert.equal(partNodes.filter((node:any) => node.missing).length, 2, 'exactly two unmatched role nodes are expected');
  for (const node of partNodes.filter((node:any) => node.source)) assertWorkspaceSource(node.source, folder, extension);

  if (process.env.FEATURE_PROJECTION_SMOKE_MODE === 'p2-cross-navigation') {
    const actions = settled.situationActions ?? [];
    assert.equal(actions.length,6,'six scoped Situations require six cross-navigation actions');
    assert.equal(new Set(actions.map((a:any)=>a.testId)).size,6,'all Situation IDs must be unique across FeatureSpaces');

    const known = new Map(flatTree.filter((n:any)=>n.kind === 'situation').map((n:any)=>[n.id,n]));
    const seen = new Set<string>();
    const revealSelectionProbes: any[] = [];
    const commandsBefore = await vscode.commands.getCommands(true);
    const canReadSelection = commandsBefore.includes('_testing.getExplorerSelection');
    const codeLens:any[] = await vscode.commands.executeCommand(
      'vscode.executeCodeLensProvider', vscode.Uri.parse('feature-projection:/projection.md'), 100
    ) ?? [];
    assert.equal(codeLens.filter(lens=>lens.command?.command==='featureProjection.revealSituationInTestExplorer').length,6);
    const assertionActions = settled.assertionSourceActions ?? [];
    assert.ok(assertionActions.length >= 6, 'installed projection must publish literal assertion source links');
    const assertionLenses = codeLens.filter(lens=>
      lens.command?.title === 'Open assertion source' ||
      lens.command?.title === 'Open responsibility verification source');
    assert.equal(assertionLenses.length,assertionActions.length,
      'Projection editor must have one CodeLens for every recognized assertion');
    const rolesWithAssertions = new Set<string>();
    for (const action of assertionActions) {
      assertWorkspaceSource(action.source,folder,extension);
      assert.ok(settled.markdown.includes(expectedSourceHref(action.source)),
        'Markdown Preview must contain native link to literal assertion source');
      rolesWithAssertions.add(action.role);
    }
    assert.deepEqual([...rolesWithAssertions].sort(),['backend','frontend']);
    for(const role of ['frontend','backend']) {
      const action=assertionActions.find((a:any)=>a.role===role);
      await assertProjectionOpenSource(action);
    }
    for (const action of actions) {
      const node:any = known.get(action.testId);
      assert.ok(node, `Missing exact TestItem: ${action.testId}`);
      const line = settled.markdown.split('\n')[action.line];
      assert.equal(line,`Situation: ${node.label}`);
      const reveal:boolean = await vscode.commands.executeCommand(
        'featureProjection.revealSituationInTestExplorer', action.testId
      );
      assert.equal(reveal,true,`reveal failed for ${action.testId}`);
      if (canReadSelection) {
        const selected = await vscode.commands.executeCommand('_testing.getExplorerSelection');
        revealSelectionProbes.push({wanted:action.testId,actual:selected});
      }
      const reverse:boolean = await vscode.commands.executeCommand(
        'featureProjection.openSituationInProjection', {id:action.testId}
      );
      assert.equal(reverse,true,`projection jump failed for ${action.testId}`);
      const editor = vscode.window.activeTextEditor;
      assert.ok(editor);
      assert.equal(editor.document.uri.scheme,'feature-projection');
      assert.equal(editor.selection.active.line,action.line);
      assert.equal(editor.document.lineAt(action.line).text,line);
      seen.add(`${node.label}:${action.testId}`);
    }
    const expired = actions.filter((a:any)=>a.testId.endsWith('/situation/expired'));
    assert.equal(expired.length,2,'same Situation label must exist in both scopes');
    assert.notEqual(expired[0].testId,expired[1].testId);
    assert.notEqual(expired[0].line,expired[1].line,'same labels must jump to distinct projection sections');
    const backendChild = actions[0].testId+'/backend';
    assert.equal(await vscode.commands.executeCommand('featureProjection.openSituationInProjection',{id:backendChild}),true,
      'child part context action must resolve to the exact Situation');
    assert.equal(vscode.window.activeTextEditor?.selection.active.line,actions[0].line);
    assert.equal(await vscode.commands.executeCommand('featureProjection.openSituationInProjection',{id:'situation/unknown'}),false);
    assert.equal(await vscode.commands.executeCommand('featureProjection.revealSituationInTestExplorer','situation/unknown'),false);
    assert.equal(vscode.window.activeTextEditor?.selection.active.line,actions[0].line,'unknown ID must not jump');
    const commandMenu = extension.packageJSON.contributes?.menus?.['testing/item/context'] ?? [];
    assert.ok(commandMenu.some((item:any)=>item.command==='featureProjection.openSituationInProjection'));
    const navigationCommand = extension.packageJSON.contributes?.commands?.find(
      (item:any)=>item.command==='featureProjection.revealSituationInTestExplorer'
    );
    assert.equal(navigationCommand?.title, 'Feature Projection: Reveal Situation in Test Explorer');
    const installedCommands = await vscode.commands.getCommands();
    assert.ok(installedCommands.includes('featureProjection.revealSituationInTestExplorer'));
    writeResult({
      ok:true,mode:'p2-cross-navigation',trusted:true,version:extension.packageJSON.version,
      extensionPath:extension.extensionPath,uiState:settled.uiState,
      featureSpaces:persisted.map((s:any)=>s.id),
      situations:actions.length,
      bidirectional:true,codeLens:true,contextMenu:true,paletteNavigation:true,
      assertionSourceNavigation:true,assertionSourceActions:assertionActions.length,
      repeatedLabelsIsolated:true,unknownIdentityRefused:true,
      revealSelectionProbeAvailable:canReadSelection,revealSelectionProbes,
      matchedSourceActions:settled.sourceActions.length,
      unmatchedParts:partNodes.filter((n:any)=>n.missing).length,
    });
    return;
  }

  writeResult({
    ok:true,
    mode:'scope-isolation',
    trusted:vscode.workspace.isTrusted,
    version:extension.packageJSON.version,
    extensionPath:extension.extensionPath,
    configured:true,
    featureSpaces:persisted.map((space:any) => space.id),
    situations:situationCount,
    sourceActions:(settled.sourceActions ?? []).length,
    unmatchedParts:partNodes.filter((node:any) => node.missing).length,
    finalState:settled.uiState,
  });
}

async function runP1InstalledProofs(folder: vscode.WorkspaceFolder, extension: any): Promise<void> {
  assert.equal(vscode.workspace.isTrusted, true, 'P1 installed proof requires a trusted isolated workspace');
  const spaces = configuredSpaces(folder);
  assert.deepEqual(spaces.map((space:any) => space.id), ['responsibility','assertions']);
  assert.ok(spaces.every((space:any) => space.sources.length === 1 && space.sources[0].adapter === 'xunit-v3'));
  assert.equal((await debugState()).hasProjection, false, 'P1 project-backed analysis must not run before explicit Refresh');

  await vscode.commands.executeCommand('featureProjection.refresh');
  const settled = await waitFor(debugState, state => state && !state.refreshing);
  const blocking = (settled.diagnostics ?? []).filter((d:any) => d.projectionImpact === 'blocks-part');
  assert.equal(settled.uiState, 'fresh', `P1 installed Refresh must become Fresh: ${JSON.stringify(blocking)}`);
  assert.equal(blocking.length, 0);
  const markdown = String(settled.markdown);
  const responsibility = markdownScope(markdown, 'responsibility/auth');
  const assertions = markdownScope(markdown, 'assertions/access');

  assert.match(responsibility, /Situation: invalid_password/);
  assert.ok(responsibility.includes('user.Verify(x => x.Authenticate("invalid"), Times.Once);'));
  assert.ok(responsibility.includes('Assert.True(true);'));
  assert.doesNotMatch(responsibility, /logger\.Verify|Authenticate\(42\)/);
  assert.match(responsibility, /#### Frontend: \[unmatched\]/);

  assert.match(assertions, /Situation: invalid_token/);
  assert.ok(assertions.includes('FeatureChecks.AssertDenied(false);'));
  assert.ok(assertions.includes('Assert.True(true);'));
  assert.doesNotMatch(assertions, /UnrelatedChecks|Telemetry\.Track|AssertDenied\("context"\)/);
  assert.match(assertions, /#### Frontend: \[unmatched\]/);

  const situations = markdown.match(/^Situation: /gm) ?? [];
  assert.equal(situations.length, 2, 'installed worker must project exactly the two proof situations');
  const sourceActions = settled.sourceActions ?? [];
  assert.equal(sourceActions.length, 2, 'each backend proof must expose a source navigation action');
  for (const action of sourceActions) {
    assert.equal(action.role, 'backend');
    assertWorkspaceSource(action.source, folder, extension);
    assert.ok(markdown.includes(expectedSourceHref(action.source)), 'installed Markdown must have native source links');
  }
  const situationNodes = flattenTestingTree(settled.testingTree ?? []).filter((node:any) => node.kind === 'situation');
  assert.equal(situationNodes.length, 2);

  if (process.env.FEATURE_PROJECTION_SMOKE_MODE === 'p2-rename-preview') {
    const contributed = extension.packageJSON.contributes?.commands?.find(
      (x:any)=>x.command==='featureProjection.previewRegisteredRename');
    assert.equal(contributed?.title, 'Feature Projection: Preview Registered C# Rename (Read-Only)');
    const scenarios=[
      {space:'responsibility',symbol:'User.Authenticate(string)',name:'AuthenticateCredentials',count:4,lines:[20,33,12,13]},
      {space:'assertions',symbol:'FeatureChecks.AssertDenied(bool)',name:'AssertAccessDenied',count:3,lines:[20,48,8]},
    ];
    const results:any[]=[];
    for (const s of scenarios) {
      const result:any=await vscode.commands.executeCommand(
        'featureProjection.__registeredRenamePreviewResult',s.space,'backend',s.symbol,s.name
      );
      assert.equal(result.preview.probeOnly,true);
      assert.equal(result.preview.mutationSupported,false);
      assert.equal(result.preview.projectScopeOnly,true);
      assert.equal(result.preview.accepted,true);
      assert.equal(result.preview.edits.length,s.count);
      assert.deepEqual(result.preview.edits.map((e:any)=>e.line).sort((a:number,b:number)=>a-b),
        [...s.lines].sort((a,b)=>a-b));
      assert.equal(await vscode.commands.executeCommand(
        'featureProjection.__showRegisteredRenamePreview',s.space,'backend',s.symbol,s.name
      ),true);
      const editor=vscode.window.activeTextEditor;
      assert.ok(editor);
      assert.ok(editor.document.uri.path.startsWith('/rename-preview/'+s.space+'/backend/'));
      const markdown=editor.document.getText();
      assert.match(markdown,/READ-ONLY RESEARCH PREVIEW/);
      assert.match(markdown,/No files are changed/);
      assert.ok(markdown.includes(s.symbol));
      assert.ok(markdown.includes(s.name));
      const lenses:any[]=await vscode.commands.executeCommand(
        'vscode.executeCodeLensProvider',editor.document.uri,100
      ) ?? [];
      const nav=lenses.filter((lens:any)=>lens.command?.command==='featureProjection.openSource');
      assert.equal(nav.length,s.count);
      for (const lens of nav) {
        const source=lens.command.arguments[0];
        assertWorkspaceSource(source,folder,extension);
        assert.ok(markdown.includes(expectedSourceHref(source)));
      }
      await assertProjectionOpenSource({
        source:nav.find((l:any)=>l.command.arguments[0].line===s.lines.at(-1))?.command.arguments[0]
      });
      results.push({space:s.space,symbol:s.symbol,previewEdits:s.count});
    }
    const rejected:any=await vscode.commands.executeCommand(
      'featureProjection.__registeredRenamePreviewResult',
      'responsibility','backend','User.Authenticate(string)','Authenticate'
    );
    assert.equal(rejected.preview.accepted,false);
    assert.deepEqual(rejected.preview.edits,[]);
    assert.ok(rejected.preview.diagnostics.length>0);
    assert.equal(await vscode.commands.executeCommand(
      'featureProjection.__showRegisteredRenamePreview',
      'responsibility','backend','User.Authenticate(string)','Authenticate'
    ),true);
    const refusalEditor=vscode.window.activeTextEditor;
    assert.match(refusalEditor?.document.getText()??'',/REFUSED — no preview edits/);
    assert.deepEqual(await vscode.commands.executeCommand(
      'vscode.executeCodeLensProvider',refusalEditor?.document.uri,100
    ) ?? [],[]);
    await assert.rejects(
      vscode.commands.executeCommand('featureProjection.__registeredRenamePreviewResult',
        'responsibility','backend','User.Authenticate(int)','BadRename'),
      /Only a uniquely registered method/
    );
    writeResult({ok:true,mode:'p2-rename-preview',trusted:true,
      version:extension.packageJSON.version,extensionPath:extension.extensionPath,
      uiState:settled.uiState,readOnly:true,scoped:true,
      scenarios:results,refusal:true,nonApplied:true,links:7});
    return;
  }
  if (process.env.FEATURE_PROJECTION_SMOKE_MODE === 'p2-registered-usages') {
    const cmd = extension.packageJSON.contributes?.commands?.find(
      (c:any)=>c.command==='featureProjection.showRegisteredUsages'
    );
    assert.equal(cmd?.title,'Feature Projection: Show Registered C# Usages');
    const visibleCommands = await vscode.commands.getCommands();
    assert.ok(visibleCommands.includes('featureProjection.showRegisteredUsages'));
    const expectations=[
      {space:'responsibility',symbol:'User.Authenticate(string)',registration:33,featureLines:[12,13]},
      {space:'assertions',symbol:'FeatureChecks.AssertDenied(bool)',registration:48,featureLines:[8]},
    ];
    const scopedResults:any[]=[];
    for(const expected of expectations) {
      const probe:any=await vscode.commands.executeCommand('featureProjection.__registeredUsageResult',expected.space,'backend');
      assert.equal(probe.featureSpaceId,expected.space);
      assert.equal(probe.sourceId,'backend');
      assert.equal(probe.result.probeOnly,true);
      assert.equal(probe.result.mutationSupported,false);
      assert.deepEqual(probe.result.diagnostics,[]);
      assert.equal(probe.result.targets.length,1);
      const target=probe.result.targets[0];
      assert.equal(target.symbol,expected.symbol);
      assert.deepEqual(target.references.filter((ref:any)=>ref.kind==='registration').map((ref:any)=>ref.source.line),[expected.registration]);
      assert.deepEqual(target.references.filter((ref:any)=>ref.kind==='feature-test').map((ref:any)=>ref.source.line),expected.featureLines);
      assert.equal(target.references.length,1+expected.featureLines.length,'wrong overloads and unrelated methods must be excluded');
      for(const usage of target.references) {
        assertWorkspaceSource(usage.source,folder,extension);
        assert.ok(path.resolve(usage.source.file).toLowerCase().startsWith(path.resolve(probe.projectRoot).toLowerCase()+path.sep));
        const text=fs.readFileSync(usage.source.file,'utf8');
        const simpleName=expected.symbol.split('(')[0].split('.').at(-1);
        assert.equal(text.slice(usage.source.start,usage.source.end),simpleName);
      }
      assert.equal(await vscode.commands.executeCommand('featureProjection.__showRegisteredUsages',expected.space,'backend'),true);
      const editor=vscode.window.activeTextEditor;
      assert.ok(editor,'Usage View must open an editor');
      assert.equal(editor.document.uri.toString(),
        vscode.Uri.parse('feature-projection:/usages/'+expected.space+'/backend.md').toString());
      assert.match(editor.document.getText(),new RegExp(expected.symbol.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
      assert.ok(editor.document.getText().includes('FeatureSpace: `'+expected.space+'`'));
      const state=await debugState();
      assert.equal(state.usageActions.length,target.references.length);
      assert.ok(editor.document.getText().includes('Read-only.'));
      for(const action of state.usageActions) {
        assertWorkspaceSource(action.source,folder,extension);
        assert.ok(editor.document.lineAt(action.line).text.includes(expectedSourceHref(action.source)));
      }
      const lenses:any[]=await vscode.commands.executeCommand(
        'vscode.executeCodeLensProvider',editor.document.uri,100
      ) ?? [];
      assert.equal(lenses.filter(l=>l.command?.command==='featureProjection.openSource').length,target.references.length);
      await assertProjectionOpenSource(state.usageActions.find((a:any)=>a.source.line===expected.featureLines[0]));
      scopedResults.push({space:expected.space,symbol:target.symbol,references:target.references.length,featureLines:expected.featureLines});
    }
    await assert.rejects(
      vscode.commands.executeCommand('featureProjection.__registeredUsageResult','nonexistent','backend'),
      /Unknown or invalid scoped C# source/
    );
    writeResult({
      ok:true,mode:'p2-registered-usages',trusted:true,version:extension.packageJSON.version,
      extensionPath:extension.extensionPath,uiState:settled.uiState,
      scenarios:scopedResults,view:true,navigation:true,codeLens:true,readOnly:true,
      registrations:2,featureUsages:3,scoped:true,
    });
    return;
  }
  writeResult({
    ok:true, mode:'p1-proofs', trusted:true, version:extension.packageJSON.version,
    extensionPath:extension.extensionPath, uiState:settled.uiState,
    situations:situations.length, sourceActions:sourceActions.length,
    registeredResponsibility:true, customAssertion:true, literalSource:true,
    unregisteredVerificationsAbsent:true, unmatchedFrontendExplicit:true,
    diagnostics:settled.diagnostics,
  });
}

async function runP2InstalledNavigation(folder: vscode.WorkspaceFolder, extension: any): Promise<void> {
  assert.equal(vscode.workspace.isTrusted, true, 'P2 navigation smoke requires trusted isolated workspace');
  assert.deepEqual(configuredSpaces(folder).map((space:any) => space.id), ['app']);
  const sources = configuredSpaces(folder)[0].sources;
  assert.deepEqual(sources.map((source:any) => source.adapter), ['vitest-5','xunit-v3']);
  assert.equal((await debugState()).hasProjection, false);

  await vscode.commands.executeCommand('featureProjection.refresh');
  const settled = await waitFor(debugState, state => state && !state.refreshing);
  const blocking = (settled.diagnostics ?? []).filter((d:any) => d.projectionImpact === 'blocks-part');
  assert.equal(settled.uiState, 'fresh', `P2 Refresh must be Fresh: ${JSON.stringify(blocking)}`);
  assert.equal(blocking.length, 0);
  const markdown = String(settled.markdown);
  assert.equal((markdown.match(/^Situation: /gm) ?? []).length, 2);
  assert.match(markdown, /Situation: expired/);
  assert.match(markdown, /Situation: locked/);
  const sourceActions = settled.sourceActions ?? [];
  assert.equal(sourceActions.length, 4, 'two exact rows with both Frontend and Backend');
  assert.deepEqual(
    sourceActions.map((a:any) => [a.role, a.source.line]),
    [['frontend',4],['backend',5],['frontend',5],['backend',6]],
    'installed source actions must target concrete row declarations, not shared methods'
  );
  for (const action of sourceActions) {
    assertWorkspaceSource(action.source, folder, extension);
    assert.ok(markdown.includes(expectedSourceHref(action.source)), 'native Markdown link must target the same concrete source row');
    await assertProjectionOpenSource(action);
  }

  const situations = flattenTestingTree(settled.testingTree ?? []).filter((n:any)=>n.kind==='situation');
  assert.equal(situations.length,2);
  for (const node of situations) {
    assert.ok(node.label === 'expired' || node.label === 'locked');
    const expected = node.label === 'expired' ? [4,5] : [5,6];
    const parts = node.children.filter((n:any)=>n.kind==='part');
    assert.equal(parts.length,2);
    assert.deepEqual(parts.map((n:any)=>n.source.line),expected,'Test Explorer must navigate to concrete rows');
  }

  writeResult({
    ok:true,mode:'p2-navigation',trusted:true,version:extension.packageJSON.version,
    extensionPath:extension.extensionPath,uiState:settled.uiState,
    situations:2,sourceActions:4,concreteSourceLines:[4,5,5,6],
    markdownLinks:true,testingTree:true,openSource:true,
    blockingDiagnostics:blocking.length,
  });
}

export async function run(): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(folder, 'fixture workspace must be open');
  assert.equal(vscode.workspace.workspaceFolders?.length, 1, 'smoke must use a single-root workspace');

  const extension = vscode.extensions.getExtension('local-prototype.feature-projection-prototype-p0');
  assert.ok(extension, 'Feature Projection extension must be installed/available');
  await extension.activate();
  if (process.env.FEATURE_PROJECTION_EXPECTED_VERSION)
    assert.equal(extension.packageJSON.version, process.env.FEATURE_PROJECTION_EXPECTED_VERSION, 'installed extension version mismatch');
  if (process.env.FEATURE_PROJECTION_EXPECTED_EXTENSION_ROOT)
    assert.ok(path.resolve(extension.extensionPath).toLowerCase().startsWith(path.resolve(process.env.FEATURE_PROJECTION_EXPECTED_EXTENSION_ROOT).toLowerCase()), 'Feature Projection must load from the isolated installed extensions directory');

  if (process.env.FEATURE_PROJECTION_SMOKE_MODE === 'normal-hooks') return await runNormalHooks(folder, extension);
  if (process.env.FEATURE_PROJECTION_SMOKE_MODE === 'prerequisite-node') return await runPrerequisite(folder, extension, 'node');
  if (process.env.FEATURE_PROJECTION_SMOKE_MODE === 'prerequisite-dotnet') return await runPrerequisite(folder, extension, 'dotnet');
  if (process.env.FEATURE_PROJECTION_SMOKE_MODE === 'untrusted') return await runUntrusted(folder, extension);
  if (process.env.FEATURE_PROJECTION_SMOKE_MODE === 'scope-isolation' ||
      process.env.FEATURE_PROJECTION_SMOKE_MODE === 'p2-cross-navigation') return await runScopeIsolation(folder, extension);
  if (process.env.FEATURE_PROJECTION_SMOKE_MODE === 'p1-proofs' ||
      process.env.FEATURE_PROJECTION_SMOKE_MODE === 'p2-registered-usages' ||
      process.env.FEATURE_PROJECTION_SMOKE_MODE === 'p2-rename-preview') {
    try {return await runP1InstalledProofs(folder, extension);}
    catch(err:any){
      writeResult({ok:false,mode:process.env.FEATURE_PROJECTION_SMOKE_MODE,
        error:err?.stack ?? String(err),extensionPath:extension.extensionPath});
      throw err;
    }
  }
  if (process.env.FEATURE_PROJECTION_SMOKE_MODE === 'p2-navigation') return await runP2InstalledNavigation(folder, extension);
  return await runTrusted(folder, extension);
}
