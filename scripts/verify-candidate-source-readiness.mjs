// D-080. Read-only vsce inventory audit. Does NOT invoke `vsce package`,
// `vscode:prepublish`, create a VSIX, or install an extension.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {inspectCandidateFileList,inspectCandidateManifest} from './candidate-source-inventory.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const lock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));
const manifest=inspectCandidateManifest(pkg,lock);
if(!manifest.ok)throw Error('Candidate manifest gate failed: '+manifest.errors.join('; '));
const cli=path.join(root,'node_modules','@vscode','vsce','vsce');
if(!fs.existsSync(cli))throw Error('Local vsce executable missing; run npm ci');
const result=spawnSync(process.execPath,[cli,'ls'],{
  cwd:root,encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024,
  windowsHide:true,
});
if(result.error||result.status!==0)throw Error(
  'Read-only vsce ls failed: '+(result.error?.message??result.stderr??String(result.status)));
const inventory=inspectCandidateFileList(result.stdout);
if(!inventory.ok)throw Error('Candidate package-content gate failed:\n'+inventory.errors.join('\n'));
console.log('D080_CANDIDATE_SOURCE_INVENTORY_PASS files='+inventory.count+
  ' dotnet='+inventory.dotnetEntries+' typescript='+inventory.typescriptEntries+
  ' vsix_created=false installed_changed=false');
