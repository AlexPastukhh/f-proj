import fs = require('node:fs');
import path = require('node:path');
import { createHash } from 'node:crypto';
import ts = require('typescript');
import { FeatureSourceConfig, PrototypeConfig, TestDefinition } from './types';
import { analyzeVitestSource, listVitestFeatureFiles, VitestCapturedInput } from '../adapters/vitestSource';

// D-069: opt-in per-session static-only feasibility. No runtime or Roslyn cache.
export interface VitestStaticCacheContext {
  config: PrototypeConfig;
  trusted: boolean;
  dirtyDocumentPaths?: readonly string[];
}
export interface VitestStaticCacheResult {
  definitions: TestDefinition[];
  state: 'hit' | 'miss' | 'bypass';
}
interface Captured {
  hash: string;
  inputs: VitestCapturedInput[];
}
interface CacheEntry {
  hash: string;
  definitions: TestDefinition[];
}
const clone = (definitions:TestDefinition[]):TestDefinition[] => structuredClone(definitions);
function contained(root:string, file:string):boolean {
  const rel=path.relative(root,file);
  return rel==='' || (rel!=='..' && !rel.startsWith('..'+path.sep) && !path.isAbsolute(rel));
}
function samePhysicalPath(left:string,right:string):boolean {
  const normalize=(value:string)=>process.platform==='win32'
    ? path.normalize(value).toLowerCase() : path.normalize(value);
  return normalize(left)===normalize(right);
}
function capture(workspaceRoot:string,source:FeatureSourceConfig,
  key:string):Captured {
  const workspace=path.resolve(workspaceRoot);
  const sourceRoot=path.resolve(workspace,source.root);
  const framework=path.resolve(workspace,source.frameworkProject);
  if(!contained(workspace,sourceRoot) || !contained(workspace,framework))
    throw Error('cache roots escape workspace');
  // The OS temporary/workspace root itself may use a short or aliased path
  // (notably on GitHub Windows runners). Compare children against the same
  // canonical workspace rather than rejecting that harmless top-level alias.
  const physicalWorkspace=fs.realpathSync.native(workspace);
  for(const root of [sourceRoot,framework]) {
    const relative=path.relative(workspace,root);
    const expected=path.resolve(physicalWorkspace,relative);
    if(!samePhysicalPath(fs.realpathSync.native(root),expected))
      throw Error('cache source or framework root is a junction');
  }
  const files=listVitestFeatureFiles(sourceRoot);
  const hash=createHash('sha256');
  hash.update('D-069/vitest-static-only/v1');
  hash.update(key);
  const inputs:VitestCapturedInput[]=[];
  for(const file of files){
    if(!contained(sourceRoot,file)) throw Error('feature test escapes source root');
    const stats=fs.lstatSync(file);
    const relativeFromWorkspace=path.relative(workspace,file);
    if(!stats.isFile() || stats.isSymbolicLink() ||
      !samePhysicalPath(fs.realpathSync.native(file),
        path.resolve(physicalWorkspace,relativeFromWorkspace)))
      throw Error('feature test is not a regular unaliased file');
    const bytes=fs.readFileSync(file);
    const relative=path.relative(workspace,file).split(path.sep).join('/');
    hash.update(JSON.stringify([relative,bytes.length]));
    hash.update(bytes);
    inputs.push({file,text:bytes.toString('utf8')});
  }
  return {hash:hash.digest('hex'),inputs};
}

export class VitestStaticCache {
  private readonly entries = new Map<string,CacheEntry>();
  constructor(private readonly maxEntries=8) {
    if(!Number.isInteger(maxEntries) || maxEntries<1 || maxEntries>128)
      throw Error('cache entry bound must be 1..128');
  }
  clear():void { this.entries.clear(); }
  get size():number { return this.entries.size; }
  analyze(source:FeatureSourceConfig, featureSpaceId:string, workspaceRoot:string,
    context:VitestStaticCacheContext):VitestStaticCacheResult {
    // Cache is not usable if unsaved buffers might differ from on-disk parsing.
    const fresh=():VitestStaticCacheResult=>({
      definitions:analyzeVitestSource(source,featureSpaceId,workspaceRoot),
      state:'bypass',
    });
    if(source.adapter!=='vitest-5' || !context.trusted ||
      !Array.isArray(context.dirtyDocumentPaths) || context.dirtyDocumentPaths.length)
      return fresh();
    const key=JSON.stringify(['D-069',ts.version,path.resolve(workspaceRoot),
      featureSpaceId,source,context.config]);
    let before:Captured;
    try { before=capture(workspaceRoot,source,key); }
    catch { return fresh(); }
    const entry=this.entries.get(key);
    if(entry && entry.hash===before.hash) {
      try {
        const after=capture(workspaceRoot,source,key);
        if(after.hash===before.hash){
          this.entries.delete(key);
          this.entries.set(key,entry); // bounded in-memory LRU
          return {definitions:clone(entry.definitions),state:'hit'};
        }
      } catch { /* fallback to authoritative fresh analysis */ }
      return fresh();
    }
    const definitions=analyzeVitestSource(
      source,featureSpaceId,workspaceRoot,before.inputs);
    // Files may have changed while parsing. Never publish an unverified cache entry.
    try {
      const after=capture(workspaceRoot,source,key);
      if(after.hash!==before.hash) return fresh();
    } catch { return fresh(); }
    this.entries.delete(key);
    this.entries.set(key,{hash:before.hash,definitions:clone(definitions)});
    while(this.entries.size>this.maxEntries)
      this.entries.delete(this.entries.keys().next().value!);
    return {definitions:clone(definitions),state:'miss'};
  }
}
