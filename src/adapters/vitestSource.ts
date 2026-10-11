import fs = require('node:fs');
import path = require('node:path');
import ts = require('typescript');
import { Diagnostic, FeatureSourceConfig, TestDefinition } from '../core/types';
import { parseDescription, VITEST_SITUATION_MARKER } from '../core/naming';

export function listVitestFeatureFiles(root: string): string[] {
  const out: string[] = [];
  for (const ent of fs.readdirSync(root, { withFileTypes: true })) {
    const p = path.join(root, ent.name);
    if (ent.isDirectory()) out.push(...listVitestFeatureFiles(p));
    else if (/\.feature\.(test|spec)\.[cm]?[tj]sx?$/.test(ent.name)) out.push(p);
  }
  return out.sort();
}

function literalText(node: any): string | undefined {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : undefined;
}

function isTestIdentifier(node: any): boolean {
  return ts.isIdentifier(node) && (node.text === 'test' || node.text === 'it');
}

function classifyTestCall(call: any): { parameterized: boolean; title?: any; body?: any } | undefined {
  if (!ts.isCallExpression(call)) return undefined;
  if (isTestIdentifier(call.expression)) return { parameterized:false, title:call.arguments[0], body:call.arguments[1] };
  if (ts.isCallExpression(call.expression)) {
    const inner = call.expression;
    if (ts.isPropertyAccessExpression(inner.expression) && inner.expression.name.text === 'each' && isTestIdentifier(inner.expression.expression)) {
      return { parameterized:true, title:call.arguments[0], body:call.arguments[1] };
    }
  }
  return undefined;
}

function staticEachCaseAnchors(call: any, title: string, sf: any, file: string) {
  // Exact static table only. This does not materialize concrete cases or derive
  // Situation: the runtime framework label must still match an anchor uniquely.
  const marker = title.match(VITEST_SITUATION_MARKER)?.[1];
  const propertyName = /^\$([A-Za-z_$][\w$]*)$/.exec(marker ?? '')?.[1];
  if (!propertyName || !ts.isCallExpression(call.expression)) return [];
  const table = call.expression.arguments[0];
  if (!table || !ts.isArrayLiteralExpression(table)) return [];
  const anchors: Array<{ label:string; source:{file:string;start:number;end:number;line:number;column:number} }> = [];
  const labels = new Set<string>();
  for (const row of table.elements) {
    if (!ts.isObjectLiteralExpression(row)) return [];
    const matching = row.properties.filter((p: any) =>
      ts.isPropertyAssignment(p) &&
      (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) &&
      p.name.text === propertyName
    );
    // Spread, shorthand or computed properties can override the label at runtime.
    if (row.properties.some((p: any) => !ts.isPropertyAssignment(p) ||
      !(ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) ||
      matching.length !== 1 || !ts.isPropertyAssignment(matching[0])) return [];
    const label = literalText(matching[0].initializer);
    if (!label || labels.has(label)) return [];
    labels.add(label);
    const start = row.getStart(sf);
    const lc = sf.getLineAndCharacterOfPosition(start);
    anchors.push({ label, source:{file,start,end:row.getEnd(),line:lc.line+1,column:lc.character+1} });
  }
  return anchors;
}

function hasExpectCall(node: any): boolean {
  let found = false;
  const visit = (n: any) => {
    if (found) return;
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'expect') { found = true; return; }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

function containsConditionalExpression(node: any): boolean {
  let found = false;
  const visit = (n: any) => {
    if (found) return;
    if (ts.isConditionalExpression(n)) { found = true; return; }
    if (ts.isBinaryExpression(n) && (n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken || n.operatorToken.kind === ts.SyntaxKind.BarBarToken)) { found = true; return; }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

function bodyDiagnostics(block: any, sf: any, file: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const st of block.statements) {
    const lc = sf.getLineAndCharacterOfPosition(st.getStart(sf));
    const source = { file, start:st.getStart(sf), end:st.getEnd(), line:lc.line+1, column:lc.character+1 };
    if (ts.isIfStatement(st)) {
      out.push({ ruleId:'feature-test/no-if', category:'projection-safety', severity:'warning', projectionImpact:'blocks-part', message:'if/else is not allowed directly in a feature-test body', source });
      continue;
    }
    const unsupported = ts.isSwitchStatement(st) || ts.isForStatement(st) || ts.isForInStatement(st) || ts.isForOfStatement(st) || ts.isWhileStatement(st) || ts.isDoStatement(st) || ts.isTryStatement(st) || ts.isLabeledStatement(st) || ts.isFunctionDeclaration(st) || (ts.isReturnStatement(st) && !!st.expression) || containsConditionalExpression(st);
    if (unsupported) out.push({ ruleId:'feature-test/unsupported-control-flow', category:'projection-safety', severity:'warning', projectionImpact:'blocks-part', message:`Unsupported top-level feature-test control flow: ${ts.SyntaxKind[st.kind]}`, source });
  }
  return out;
}

export interface VitestCapturedInput { file:string; text:string; }

export function analyzeVitestSource(source: FeatureSourceConfig, featureSpaceId: string,
  workspaceRoot: string, captured?:readonly VitestCapturedInput[]): TestDefinition[] {
  const physicalRoot = path.resolve(workspaceRoot, source.root);
  const frameworkProject = path.resolve(workspaceRoot, source.frameworkProject);
  const definitions: TestDefinition[] = [];
  // The optional capture lets the static cache parse precisely the bytes it hashed.
  // Without a capture the existing adapter still reads the current source files.
  const inputs = captured ?? listVitestFeatureFiles(physicalRoot).map(file =>
    ({file,text:fs.readFileSync(file,'utf8')}));
  for (const {file,text} of inputs) {
    const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
    const visit = (node: any) => {
      if (ts.isCallExpression(node)) {
        const info = classifyTestCall(node);
        if (info && info.title && info.body) {
          const title = literalText(info.title);
          if (title && (ts.isArrowFunction(info.body) || ts.isFunctionExpression(info.body)) && ts.isBlock(info.body.body)) {
            const semanticTitle = info.parameterized ? title.replace(VITEST_SITUATION_MARKER, '') : title;
            const parsed = parseDescription(title, info.parameterized);
            const start = node.getStart(sf);
            const lc = sf.getLineAndCharacterOfPosition(start);
            const range = { file, start, end:node.getEnd(), line:lc.line+1, column:lc.character+1 };
            const assertions = [] as any[];
            for (const st of info.body.body.statements) {
              if (ts.isExpressionStatement(st) && hasExpectCall(st)) {
                const slc = sf.getLineAndCharacterOfPosition(st.getStart(sf));
                assertions.push({ sourceCode:text.slice(st.getStart(sf), st.getEnd()), source:{ file, start:st.getStart(sf), end:st.getEnd(), line:slc.line+1, column:slc.character+1 }, kind:'assertion' });
              }
            }
            const diagnostics = [...parsed.diagnostics.map(d => ({...d, source:range})), ...bodyDiagnostics(info.body.body, sf, file)];
            if (assertions.length === 0) diagnostics.push({ ruleId:'feature-test/no-recognized-assertions', category:'projection-safety', severity:'warning', projectionImpact:'degrades-part', message:'No recognized assertions in feature-test body', source:range });
            const logicalFolderKey = path.relative(physicalRoot, path.dirname(file)).split(path.sep).join('/') || '.';
            const defKey = `${path.relative(frameworkProject,file).split(path.sep).join('/')}:${lc.line+1}:${lc.character+1}`;
            // Vitest reports the invocation containing the title (after the .each
            // table), which may be several lines below the expression's start.
            const taskLocation = info.parameterized
              ? sf.getLineAndCharacterOfPosition(node.expression.getEnd())
              : undefined;
            definitions.push({
              id:`${source.id}:${defKey}`,
              featureSpaceId,
              logicalFolderKey,
              partRole:source.role,
              adapterId:'vitest-5',
              frameworkProject,
              isParameterized:info.parameterized,
              featureName:parsed.featureName,
              outcome:parsed.outcome,
              directSituation:parsed.situation,
              expectedBehavior:parsed.expectedBehavior,
              assertions,
              source:range,
              definitionRef:{
                adapterId:'vitest-5', frameworkProject, frameworkDefinitionKey:defKey, sourceFile:file, sourceLine:lc.line+1,
                frameworkTaskLine:taskLocation ? taskLocation.line+1 : undefined,
                frameworkTaskColumn:taskLocation ? taskLocation.character+1 : undefined,
              },
              caseSourceAnchors:info.parameterized ? staticEachCaseAnchors(node, title, sf, file) : undefined,
              diagnostics,
            });
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return definitions;
}
