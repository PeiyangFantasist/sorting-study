from pathlib import Path
import re
import tinycss2

base = Path(__file__).resolve().parent.parent
source = (base / 'web/style.css').read_text(encoding='utf-8')
html = (base / 'release/sorting-review.html').read_text(encoding='utf-8')
exported = re.search(r'<style>\s*([\s\S]*?)</style>', html).group(1).rstrip()
expected = source.split('\n', 1)[1].rstrip()
assert exported == expected, 'Export must preserve every non-import CSS byte'

def rules(css):
    return tinycss2.parse_stylesheet(css, skip_whitespace=True, skip_comments=True)

def root_vars(css):
    for rule in rules(css):
        if rule.type == 'qualified-rule' and tinycss2.serialize(rule.prelude).strip() == ':root':
            return {d.name: tinycss2.serialize(d.value).strip()
                    for d in tinycss2.parse_declaration_list(rule.content)
                    if d.type == 'declaration' and d.name.startswith('--')}
    return {}

variables = root_vars(exported)
assert variables['--coral'] == '#d98c6d'
assert variables['--amber'] == '#e6ae55'
assert variables['--green'] == '#246a55'
assert variables == root_vars(expected), 'Exported theme must match hosted source'
referenced = set(re.findall(r'var\((--[\w-]+)', exported))
assert referenced - set(variables) == {'--height'}, 'Only bar height is supplied inline'

backgrounds = {}
for rule in rules(exported):
    assert rule.type != 'error', f'Stylesheet parse error: {rule}'
    if rule.type != 'qualified-rule':
        continue
    selector = tinycss2.serialize(rule.prelude).strip()
    for declaration in tinycss2.parse_declaration_list(rule.content):
        if declaration.type == 'declaration' and declaration.name == 'background':
            backgrounds[selector] = tinycss2.serialize(declaration.value).strip()

for selector, name in {'.bar.active': '--amber', '.bar.changed': '--coral',
                       '.bar.sorted': '--green'}.items():
    assert backgrounds[selector] == f'var({name})'
    assert variables[name] not in ('transparent', '')
assert 'gradient' in backgrounds['.primary-button'] and '#246a55' in backgrounds['.primary-button']

# Prove this check catches the original export defect caused by font URL semicolons.
broken = re.sub(r'^@import[^;]+;\s*', '', source)
assert not root_vars(broken), 'The original defect must reproduce as a missing root rule'

assert '<script src=' not in html and '@import' not in html
print(f'PASS: all {len(variables)} theme variables preserved; compare/write/sorted bars and playback button resolve to opaque colors; original defect reproduced and rejected; no external runtime dependencies.')
