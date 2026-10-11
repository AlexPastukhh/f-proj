// Source-only audit of the *prospective* VSIX contents.
// Accept the actual `vsce ls` file list; never generate/package/install VSIX.
export const requiredCandidateFiles=[
  'package.json',
  'README.md',
  'dist/extension.js',
  'dist/core/runSessionGate.js',
  'dist/core/runSelectionGate.js',
  'dist/core/runBothSituation.js',
  'dist/core/vitestSituationRunner.js',
  'dist/core/xunitFactRunner.js',
  'dist/core/xunitTheoryRun.js',
  'dist/adapters/vitestSource.js',
  'dist/adapters/dotnetClient.js',
  'workers/vitest-materialize.mjs',
  'workers/dotnet/runtime/FeatureProjection.DotNetWorker.dll',
  'workers/dotnet/runtime/FeatureProjection.DotNetWorker.deps.json',
  'workers/dotnet/runtime/FeatureProjection.DotNetWorker.runtimeconfig.json',
  'workers/dotnet/runtime/Microsoft.CodeAnalysis.CSharp.dll',
  'workers/dotnet/runtime/Microsoft.CodeAnalysis.Workspaces.MSBuild.dll',
  'workers/dotnet/runtime/xunit.v3.core.dll',
  'node_modules/typescript/package.json',
  'node_modules/typescript/lib/typescript.js',
];
const allowed=(file)=>
  file==='package.json'||file==='README.md'||
  file==='workers/vitest-materialize.mjs'||
  file.startsWith('dist/')||
  file.startsWith('workers/dotnet/runtime/')||
  file.startsWith('node_modules/typescript/');
const blocked=/(^|\/)(?:\.git(?:hub)?|\.vscode(?:-test)?|artifacts|docs|fixtures|scripts|src|test|TestResults)(?:\/|$)|(^|\/)(?:\.env(?:\..*)?|\.npmrc|\.netrc|.*\.(?:pdb|vsix|zip|log|pem|pfx|p12|key|tsbuildinfo))$/i;
export function inspectCandidateFileList(input){
  const files=typeof input==='string'?input.split(/\r?\n/):input;
  const entries=files.map(x=>x.trim()).filter(Boolean).map(x=>x.replace(/\\/g,'/'));
  const errors=[];
  if(entries.length===0)errors.push('VSCE file inventory is empty');
  const unique=new Set(entries);
  if(unique.size!==entries.length)errors.push('Duplicate VSCE paths');
  for(const file of entries){
    if(file.startsWith('/')||file.includes('..')||file.includes('//')||!allowed(file)||blocked.test(file))
      errors.push('Unexpected packaged path: '+file);
  }
  for(const file of requiredCandidateFiles){
    if(!unique.has(file))errors.push('Required runtime asset absent: '+file);
  }
  return {ok:errors.length===0,errors,count:entries.length,
    dotnetEntries:entries.filter(x=>x.startsWith('workers/dotnet/runtime/')).length,
    typescriptEntries:entries.filter(x=>x.startsWith('node_modules/typescript/')).length};
}
export function inspectCandidateManifest(pkg,lock){
  const errors=[];
  if(pkg.name!=='feature-projection-prototype-p0'||pkg.version!=='0.1.0'||
     pkg.private!==true||pkg.main!=='dist/extension.js')
    errors.push('Candidate identity/version must remain prototype p0 0.1.0 private');
  if(pkg.dependencies?.typescript!=='5.8.3'||lock.packages?.['']?.dependencies?.typescript!=='5.8.3')
    errors.push('TypeScript production dependency must be pinned in package+lock');
  if(pkg.scripts?.['vscode:prepublish']!=='npm run build && npm run verify:packaged-worker')
    errors.push('VSIX prepublish must build source and validate .NET payload');
  if(!pkg.scripts?.['package:vsix']?.includes('vsce package'))
    errors.push('Explicit, separate VSIX packaging script is missing');
  return {ok:errors.length===0,errors};
}
