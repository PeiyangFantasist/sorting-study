const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const calls = [];
const context = {
  location:{origin:'https://appassets.androidplatform.net'},
  navigator:{}, document:{addEventListener(){}},
  SortingAndroidNative:{
    saveCpp(id,filename,code){ calls.push({method:'saveCpp',id,filename,code}); },
    copyText(id,text){ calls.push({method:'copyText',id,text}); }
  }
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../bridge.js'),'utf8'),context);
(async()=>{
  const saved=context.SortDesktop.saveCpp('int main() {}','quick-sort.cpp');
  assert.deepEqual(calls[0],{method:'saveCpp',id:1,filename:'quick-sort.cpp',code:'int main() {}'});
  context.SortAndroidResolve(1,true);
  assert.equal(await saved,true);
  const canceled=context.SortDesktop.saveCpp('code','heap-sort.cpp');
  context.SortAndroidResolve(2,false);
  assert.equal(await canceled,false);
  const copied=context.navigator.clipboard.writeText('cpp example');
  assert.equal(calls[2].text,'cpp example');
  context.SortAndroidResolve(3,true);
  assert.equal(await copied,true);
  const failed=context.navigator.clipboard.writeText('cpp example');
  context.SortAndroidResolve(4,false);
  await assert.rejects(failed,/复制失败/);
  context.SortAndroidResolve(999,true);
  console.log('PASS: Android bridge preserves code/filename, handles save/cancel, and reports clipboard failures.');
})().catch(error=>{console.error(error);process.exitCode=1;});
