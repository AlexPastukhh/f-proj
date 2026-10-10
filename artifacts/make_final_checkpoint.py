from pathlib import Path
import zipfile, hashlib, shutil

src = Path(r'C:\Users\alexa\Downloads\feature-projection-prototype-p0-0.1.0-release-gate')
downloads = Path(r'C:\Users\alexa\Downloads')
vsix_src = src / 'artifacts' / 'feature-projection-prototype-p0-0.1.0.vsix'
vsix_dst = downloads / 'feature-projection-prototype-p0-0.1.0.vsix'
zip_dst = downloads / 'feature-projection-prototype-p0-0.1.0-release-gate.zip'
shutil.copy2(vsix_src, vsix_dst)
if zip_dst.exists(): zip_dst.unlink()

excluded = {'node_modules','artifacts','bin','obj','.vscode-test'}
files = []
for p in src.rglob('*'):
    if not p.is_file(): continue
    rel = p.relative_to(src)
    parts = set(rel.parts)
    # Keep packaged worker runtime even though other bin/obj output is excluded.
    if any(x in parts for x in excluded):
        continue
    files.append((p, rel))

with zipfile.ZipFile(zip_dst, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for p, rel in files: z.write(p, rel.as_posix())

def sha(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        for chunk in iter(lambda:f.read(1024*1024), b''): h.update(chunk)
    return h.hexdigest().upper()

with zipfile.ZipFile(zip_dst) as z:
    names=z.namelist()
    leaks=[n for n in names if any('/'+x+'/' in '/'+n+'/' for x in excluded)]
    runtime=[n for n in names if n.startswith('workers/dotnet/runtime/')]
print(f'VSIX={vsix_dst}')
print(f'VSIX_BYTES={vsix_dst.stat().st_size}')
print(f'VSIX_SHA256={sha(vsix_dst)}')
print(f'ZIP={zip_dst}')
print(f'ZIP_BYTES={zip_dst.stat().st_size}')
print(f'ZIP_SHA256={sha(zip_dst)}')
print(f'ZIP_ENTRIES={len(names)}')
print(f'EXCLUDED_PATH_LEAKS={len(leaks)}')
print(f'PACKAGED_WORKER_RUNTIME_ENTRIES={len(runtime)}')