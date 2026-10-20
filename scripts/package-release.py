"""Package tracked source plus the three release builds; never copy the workspace."""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import zipfile

root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
if not re.fullmatch(r'\d+\.\d+\.\d+', version):
    raise ValueError('Expected a numeric release version')
release = root / 'release'
binaries = ['sorting-review.html', 'SortingStudy.exe', 'SortingStudy-android.apk']
for name in binaries:
    if not (release / name).is_file():
        raise FileNotFoundError(f'Build or copy release/{name} first')

tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=root).decode('utf-8').split('\0')
sources = [p for p in tracked if p and p != 'release/.gitkeep']
if not sources:
    raise RuntimeError('Stage the source files before packaging')
for name in sources:
    parts = {p.lower() for p in Path(name).parts}
    if parts & {'.git', '.openai', 'signing', 'toolchain', 'test-data', 'node_modules'}:
        raise RuntimeError(f'Unexpected private or generated directory: {name}')
    if Path(name).suffix.lower() in {'.p12', '.pfx', '.jks', '.keystore', '.dpapi', '.pem', '.key'}:
        raise RuntimeError(f'Unexpected signing material: {name}')

archive = release / f'SortingStudy-{version}.zip'
prefix = f'SortingStudy-{version}/'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
    for name in sorted(sources):
        bundle.write(root / name, prefix + name)
    for name in binaries:
        bundle.write(release / name, prefix + 'release/' + name)

with zipfile.ZipFile(archive) as bundle:
    if bundle.testzip() is not None:
        raise RuntimeError('ZIP integrity check failed')
    assert len(bundle.namelist()) == len(sources) + len(binaries)

checksum = release / 'SHA256SUMS.txt'
checksum.write_text(''.join(
    hashlib.sha256((release / name).read_bytes()).hexdigest() + '  ' + name + '\n'
    for name in binaries + [archive.name]
), encoding='utf-8')
print(f'{archive.name}: {archive.stat().st_size:,} bytes; {len(sources)} source files + 3 builds')
print('SHA256SUMS.txt written; ZIP integrity verified.')
