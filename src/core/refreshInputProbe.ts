import fs = require('node:fs');
import path = require('node:path');
import { createHash } from 'node:crypto';
import { PrototypeConfig, FeatureSourceConfig } from './types';

// D-068: known-input observation, NOT authorization to cache framework output.
export interface RefreshInputProbeOptions {
  workspaceRoot: string;
  config: PrototypeConfig;
  trusted: boolean;
  dirtyDocumentPaths?: readonly string[];
}
export interface ObservedInputScope {
  featureSpaceId: string;
  sourceId: string;
  status: 'observed' | 'unverifiable';
  fingerprint?: string;
  fileCount: number;
  ignoredDirectoryCount: number;
  reason?: string;
}
export interface RefreshInputProbe {
  kind: 'feature-projection/refresh-input-probe';
  reusePermitted: false;
  scopes: ObservedInputScope[];
}
export interface InputScopeDifference {
  featureSpaceId: string;
  sourceId: string;
  state: 'observed-unchanged' | 'observed-changed' | 'unverifiable';
}
// Excluded build/dependency trees are NOT certified by this partial probe.
const ignoredDirectories = new Set(['.git','node_modules','bin','obj','dist','.cache','.vs']);
function inside(root:string,target:string):boolean {
  const rel=path.relative(root,target);
  return rel==='' || (rel!=='..' && !rel.startsWith('..'+path.sep) && !path.isAbsolute(rel));
}
function canonical(value:unknown):string {
  if(Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if(value && typeof value==='object')
    return '{'+Object.entries(value).filter(([,v])=>v!==undefined)
      .sort(([a],[b])=>a<b?-1:a>b?1:0)
      .map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
  const encoded=JSON.stringify(value);
  if(encoded===undefined) throw Error('unserializable configuration');
  return encoded;
}
function observeScope(root:string,config:PrototypeConfig,
  featureSpaceId:string,source:FeatureSourceConfig):ObservedInputScope {
  const digest=createHash('sha256'),files=new Set<string>();
  let ignoredDirectoryCount=0;
  digest.update('D-068/known-input-observation-v1');
  digest.update(canonical(config)); // intentionally invalidates every scope on config changes
  digest.update(JSON.stringify([featureSpaceId,source.id]));
  const scan=(location:string):void=>{
    const stat=fs.lstatSync(location); // no symlinks or junctions
    if(stat.isSymbolicLink()) throw Error('symbolic link');
    if(stat.isDirectory()){
      for(const name of fs.readdirSync(location).sort()){
        const child=path.join(location,name);
        const childStat=fs.lstatSync(child);
        if(childStat.isSymbolicLink()) throw Error('symbolic link');
        if(childStat.isDirectory() && ignoredDirectories.has(name)){
          ignoredDirectoryCount++;
          continue;
        }
        scan(child);
      }
    } else if(stat.isFile()){
      if(!inside(root,location)) throw Error('file outside workspace');
      const relative=path.relative(root,location).split(path.sep).join('/');
      if(files.has(relative)) return;
      files.add(relative);
      const bytes=fs.readFileSync(location);
      digest.update(JSON.stringify([relative,bytes.length]));
      digest.update(bytes);
    } else throw Error('unsupported filesystem node');
  };
  const roots=[source.frameworkProject,source.root].map(p=>path.resolve(root,p));
  if(source.adapter==='xunit-v3' && source.projectFile)
    roots.push(path.resolve(root,source.frameworkProject,source.projectFile));
  if(source.adapter==='vitest-5' && source.configFile)
    roots.push(path.resolve(root,source.frameworkProject,source.configFile));
  for(const location of roots){
    if(!inside(root,location)) throw Error('configured path escapes workspace');
    const physical=fs.realpathSync.native(location);
    if(!inside(root,physical) || physical!==location)
      throw Error('configured path aliases or escapes workspace');
    scan(location);
  }
  return {featureSpaceId,sourceId:source.id,status:'observed',
    fingerprint:digest.digest('hex'),fileCount:files.size,ignoredDirectoryCount};
}
export function observeRefreshInputs(options:RefreshInputProbeOptions):RefreshInputProbe {
  const scopes:ObservedInputScope[]=[];
  const invalid=(featureSpaceId:string,sourceId:string,reason:string):ObservedInputScope=>
    ({featureSpaceId,sourceId,status:'unverifiable',fileCount:0,ignoredDirectoryCount:0,reason});
  let root:string|undefined;
  try {
    if(!options.trusted) throw Error('workspace untrusted');
    if(!options.dirtyDocumentPaths) throw Error('dirty editor state unknown');
    if(options.dirtyDocumentPaths.length) throw Error('dirty documents present');
    root=fs.realpathSync.native(path.resolve(options.workspaceRoot));
    if(!fs.statSync(root).isDirectory()) throw Error('not a workspace directory');
  } catch { /* failure cannot authorize reuse */ }
  const spaces=Array.isArray(options.config?.featureSpaces)?options.config.featureSpaces:[];
  for(const space of spaces){
    for(const source of Array.isArray(space.sources)?space.sources:[]){
      const id=typeof source?.id==='string'?source.id:'<invalid>';
      const spaceId=typeof space.id==='string'?space.id:'<invalid>';
      if(!root){
        scopes.push(invalid(spaceId,id,'trust, editor or workspace unavailable'));
        continue;
      }
      try {
        if(!source?.root || !source.frameworkProject ||
          !['vitest-5','xunit-v3'].includes(source.adapter) ||
          (source.adapter==='xunit-v3' && !source.projectFile))
          throw Error('invalid source configuration');
        scopes.push(observeScope(root,options.config,spaceId,source));
      } catch {
        scopes.push(invalid(spaceId,id,'input path or filesystem unavailable'));
      }
    }
  }
  scopes.sort((a,b)=>a.featureSpaceId.localeCompare(b.featureSpaceId) ||
    a.sourceId.localeCompare(b.sourceId));
  return {kind:'feature-projection/refresh-input-probe',reusePermitted:false,scopes};
}
export function compareObservedRefreshInputs(
  before:RefreshInputProbe,after:RefreshInputProbe,
):{reusePermitted:false;differences:InputScopeDifference[]} {
  const key=(s:ObservedInputScope)=>JSON.stringify([s.featureSpaceId,s.sourceId]);
  const indexes=[new Map<string,ObservedInputScope>(),new Map<string,ObservedInputScope>()];
  const duplicate=new Set<string>();
  for(const [i,input] of [before,after].entries()){
    for(const scope of input.scopes){
      const id=key(scope);
      if(indexes[i].has(id)) duplicate.add(id);
      indexes[i].set(id,scope);
    }
  }
  const differences:InputScopeDifference[]=[];
  const keys=new Set([...indexes[0].keys(),...indexes[1].keys()]);
  for(const id of [...keys].sort()){
    const left=indexes[0].get(id),right=indexes[1].get(id);
    const [featureSpaceId,sourceId]=JSON.parse(id) as [string,string];
    const state:InputScopeDifference['state']=duplicate.has(id) ||
      (left && left.status!=='observed') || (right && right.status!=='observed')
      ? 'unverifiable' : !left || !right || left.fingerprint!==right.fingerprint
        ? 'observed-changed' : 'observed-unchanged';
    differences.push({featureSpaceId,sourceId,state});
  }
  return {reusePermitted:false,differences};
}
