const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../web');
let html = fs.readFileSync(path.join(root,'index.html'),'utf8');
// Font URLs contain semicolons inside their quoted values. Match the whole
// url(...) import so a URL fragment cannot swallow the following :root rule.
const sourceCss = fs.readFileSync(path.join(root,'style.css'),'utf8');
const css = sourceCss.replace(/^\s*@import\s+url\(\s*(?:'[^']*'|"[^"]*"|[^)])*\)\s*;\s*/, '');
if (!css.startsWith(':root{') || !css.includes('--coral:#d98c6d')) {
  throw new Error('Offline CSS must retain its root theme and animation colors');
}
html = html.replace('<link rel="stylesheet" href="style.css">', () => '<style>\n'+css+'\n</style>');
for(const file of ['trace.js','algorithms-basic.js','algorithms-advanced.js','lessons.js','app.js']) {
  const script = fs.readFileSync(path.join(root,file),'utf8');
  if(script.includes('</script')) throw new Error('Unexpected script closing sequence in '+file);
  html = html.replace('<script src="'+file+'"></script>', () => '<script>\n'+script+'\n</script>');
}
const output = path.resolve(__dirname,'../release/sorting-review.html');
if(/<script src=|<link rel="stylesheet"|@import/.test(html)) throw new Error('Offline export still has an external dependency');
if (html.match(/<style>\s*([^]*?)<\/style>/)?.[1] !== css+'\n') throw new Error('Offline CSS changed during embedding');
fs.mkdirSync(path.dirname(output), {recursive:true});
fs.writeFileSync(output,html);
console.log('Offline page exported: '+Buffer.byteLength(html)+' bytes');
