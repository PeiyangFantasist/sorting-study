"""Bundle the repository's offline HTML for Android; uses only Python's stdlib."""
from pathlib import Path

base = Path(__file__).resolve().parent
source = base.parent / "release" / "sorting-review.html"
html = source.read_text(encoding="utf-8")
bridge = (base / "bridge.js").read_text(encoding="utf-8")
csp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
assert '<head>' in html and '<script>' in html, "Export the offline HTML before building Android."
html = html.replace('<head>', '<head>\n<meta http-equiv="Content-Security-Policy" content="' + csp + '">', 1)
html = html.replace('<script>', '<script>\n' + bridge + '\n</script>\n<script>', 1)
assert '@import' not in html and '<script src=' not in html
assert html.index('window.SortDesktop =') < html.index('window.Trace =')
(base / 'assets').mkdir(exist_ok=True)
(base / 'assets' / 'index.html').write_text(html, encoding='utf-8')
print('Android offline assets prepared.')
