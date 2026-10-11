import { JoinedSituation, FeaturePartScenario, SourceRange } from './types';
import { PORTABLE_HTML_MARKER } from './portableHtmlStorage';
import { situationTestId } from './testingTree';

// A single offline, script-free Projection HTML document, rendered from the
// same joined data as the VS Code Markdown/Testing API. Not a JSON export.
export interface PortableProjectionOptions {
  sourceHref?: (source:SourceRange)=>string|undefined;
}
function html(value:string):string {
  return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function sourceLink(source:SourceRange,options:PortableProjectionOptions):string {
  const name=source.file.split(/[\\/]/).pop() || 'source';
  const label=html(name+':'+source.line);
  const href=options.sourceHref?.(source);
  // Do not allow arbitrary URIs or injected HTML from a callback.
  if (!href || !/^vscode(?:-insiders)?:\/\/file\//.test(href) ||
      /[\u0000-\u0020<>"']/.test(href)) return '<span>'+label+'</span>';
  return '<a rel="noopener noreferrer" href="'+html(href)+'" title="Open source in VS Code">'+label+'</a>';
}
function part(name:string, evidence:FeaturePartScenario|undefined,
  options:PortableProjectionOptions):string {
  if (!evidence) return '<section class="part missing"><h4>'+name+
    '</h4><p class="muted">No matching part.</p></section>';
  const source=evidence.navigationSource??evidence.source;
  const assertions=evidence.assertions.map(a=>'<li><div class="assertion-heading">'+
    html(a.kind)+' · '+sourceLink(a.source,options)+'</div><pre><code>'+
    html(a.sourceCode)+'</code></pre></li>').join('');
  return '<section class="part"><h4>'+name+
    ' <small>'+sourceLink(source,options)+'</small></h4>'+
    '<p><strong>Expected behavior:</strong> <code>'+html(evidence.expectedBehavior)+'</code></p>'+
    '<p class="muted">Trust: '+html(evidence.trust)+'</p>'+
    '<h5>Assertions</h5>'+(assertions?'<ul class="assertions">'+assertions+'</ul>':
    '<p class="muted">None recognized.</p>')+'</section>';
}
export function renderPortableProjection(
  joined:JoinedSituation[],options:PortableProjectionOptions={},
):string {
  const sections:string[]=[];
  let prevScope='';
  const seen=new Set<string>();
  const rows=[...joined].sort((a,b)=>{
    const x=situationTestId(a),y=situationTestId(b);
    return x<y?-1:x>y?1:0;
  });
  for (const s of rows) {
    const semanticId=situationTestId(s);
    if(seen.has(semanticId)) throw new Error('Duplicate portable Projection Situation identity');
    seen.add(semanticId);
    const scope=JSON.stringify([s.featureSpaceId,s.logicalFolderKey,s.featureName]);
    if (scope!==prevScope) {
      sections.push('<h2 class="feature">'+html(s.featureName)+
        '</h2><p class="scope">Scope: '+html(s.featureSpaceId)+' / '+
        html(s.logicalFolderKey)+'</p>');
      prevScope=scope;
    }
    const anchor='s-'+Buffer.from(semanticId,'utf8').toString('base64url');
    sections.push('<article class="situation" id="'+html(anchor)+'">'+
      '<h3>Outcome: '+html(s.outcome)+'</h3>'+
      '<p>Situation: <strong>'+html(s.situation)+'</strong> <a class="permalink" href="#'+
      html(anchor)+'" title="Link to this Situation">#</a></p>'+
      '<div class="parts">'+part('Frontend',s.frontend,options)+
      part('Backend',s.backend,options)+'</div></article>');
  }
  const body=sections.length?sections.join('\n'):'<p class="muted">No Situations. Refresh Feature Projection in VS Code.</p>';
  return '<!doctype html>\n'+PORTABLE_HTML_MARKER+'\n<html lang="en"><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;; base-uri &#39;none&#39;; form-action &#39;none&#39;; img-src &#39;none&#39;">'+
    '<title>Feature Projection</title><style>'+
    'body{font:16px/1.55 system-ui,sans-serif;max-width:1100px;margin:2rem auto;padding:0 1rem;color:#202830;background:#fff}'+
    '.muted,.scope{color:#586574}.feature{margin-top:2.5rem;border-bottom:1px solid #d8dfe6;padding-bottom:.4rem}'+
    '.situation{border:1px solid #d8dfe6;border-radius:10px;padding:1rem;margin:1rem 0}'+
    '.parts{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem}'+
    '.part{min-width:0;padding:.8rem;border:1px solid #e6ebef;border-radius:8px}'+
    '.part.missing{background:#f6f8fa}.part h4{margin:.1rem 0}.part small{font-weight:normal}'+
    '.assertions{padding-left:1.3rem}.assertions li{margin:0 0 1rem}'+
    'pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f3f6f9;padding:.75rem;border-radius:6px}'+
    'a{color:#1254a5}.permalink{font-size:.8rem}'+
    '@media(prefers-color-scheme:dark){body{color:#e6eaf0;background:#181d23}.muted,.scope{color:#a9b7c6}.part,.situation{border-color:#46515d}.part.missing,pre{background:#242c34}a{color:#8abbff}}'+
    '</style></head><body><header><h1>Feature Projection</h1>'+
    '<p class="muted">Offline snapshot · source links open local VS Code if installed. '+
    'The document updates only after Refresh in its originating workspace.</p></header>'+
    '<main>'+body+'</main></body></html>\n';
}
