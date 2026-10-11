import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {
  requiredCandidateFiles,inspectCandidateFileList,inspectCandidateManifest,
} from '../scripts/candidate-source-inventory.mjs';
const require=createRequire(import.meta.url);
const pkg=require('../package.json');
const lock=require('../package-lock.json');

test('D-080 candidate inventory requires real production runtime and dependencies',()=>{
  const input=[...requiredCandidateFiles,
    'workers/dotnet/runtime/runtimes/win/lib/net8.0/System.Diagnostics.EventLog.dll',
    'node_modules/typescript/lib/lib.d.ts',
  ];
  const ok=inspectCandidateFileList(input.join('\n'));
  assert.equal(ok.ok,true,JSON.stringify(ok));
  assert.equal(ok.typescriptEntries>=2,true);
  assert.equal(inspectCandidateManifest(pkg,lock).ok,true);
});

test('D-080 refuses incomplete or dependency-free vsce inventory',()=>{
  for(const essential of ['node_modules/typescript/lib/typescript.js',
    'workers/dotnet/runtime/FeatureProjection.DotNetWorker.dll','dist/extension.js',
    'dist/core/runSessionGate.js']){
    const result=inspectCandidateFileList(
      requiredCandidateFiles.filter(file=>file!==essential));
    assert.equal(result.ok,false,essential);
    assert.match(result.errors.join(' '),/Required runtime asset absent/);
  }
});

test('D-080 refuses workspace/private/build files and duplicates',()=>{
  for(const bad of [
    'src/extension.ts','test/a.test.mjs','docs/plan/MASTER-PLAN.md',
    'fixtures/workspace/feature-projection.config.json','scripts/install-vsix.ps1',
    'artifacts/new.vsix','.github/workflows/windows-source-proof.yml',
    'workers/dotnet/runtime/FeatureProjection.DotNetWorker.pdb',
    'node_modules/typescript/.env','workers/dotnet/runtime/../secret',
    '../outside.txt','C:/Users/secret.txt',
  ]){
    const got=inspectCandidateFileList([...requiredCandidateFiles,bad]);
    assert.equal(got.ok,false,bad);
    assert.match(got.errors.join(' '),/Unexpected packaged path/);
  }
  assert.equal(inspectCandidateFileList([...requiredCandidateFiles,
    requiredCandidateFiles[0]]).ok,false);
});

test('D-080 refuses unpinned TypeScript or accidental version/release drift',()=>{
  assert.equal(inspectCandidateManifest({...pkg,version:'0.1.1'},lock).ok,false);
  assert.equal(inspectCandidateManifest({...pkg,private:false},lock).ok,false);
  assert.equal(inspectCandidateManifest({...pkg,
    dependencies:{typescript:'^5.8.3'}},lock).ok,false);
  assert.equal(inspectCandidateManifest(pkg,{...lock,
    packages:{...lock.packages,'':{
      ...lock.packages[''],dependencies:{typescript:'5.9.0'},
    }}}).ok,false);
  assert.equal(inspectCandidateManifest({...pkg,
    scripts:{...pkg.scripts,'vscode:prepublish':'npm run build'}},lock).ok,false);
});
