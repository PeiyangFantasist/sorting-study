const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const dir = require('node:path').resolve(__dirname, '../web') + '/';
const context = {};
context.window = context;
vm.createContext(context);
for (const file of ['trace.js', 'algorithms-basic.js', 'algorithms-advanced.js', 'lessons.js']) {
  vm.runInContext(fs.readFileSync(dir + file, 'utf8'), context, { filename: file });
}
function reference(id, values) {
  const a = [...values];
  const stats = { comparisons: 0, writes: 0, swaps: 0 };
  const compare = (x, y, type) => { stats.comparisons++; return type === 'le' ? x <= y : type === 'lt' ? x < y : type === 'ge' ? x >= y : x > y; };
  const swap = (i, j) => { [a[i], a[j]] = [a[j], a[i]]; stats.writes += 2; stats.swaps++; };
  if (id === 'insertion' || id === 'shell') {
    const gaps = id === 'insertion' ? [1] : [];
    if (id === 'shell') for (let g = Math.floor(a.length / 2); g > 0; g = Math.floor(g / 2)) gaps.push(g);
    for (const gap of gaps) for (let i = gap; i < a.length; i++) {
      const x = a[i]; let j = i;
      while (j >= gap && compare(a[j-gap], x)) { a[j] = a[j-gap]; stats.writes++; j -= gap; }
      a[j] = x; stats.writes++;
    }
  } else if (id === 'binary') {
    for (let i=1;i<a.length;i++) {
      const x=a[i]; let lo=0,hi=i;
      while(lo<hi) {const mid=lo+Math.floor((hi-lo)/2); if(compare(a[mid],x,'le')) lo=mid+1; else hi=mid;}
      for(let j=i;j>lo;j--) {a[j]=a[j-1];stats.writes++;}a[lo]=x;stats.writes++;
    }
  } else if (id === 'bubble') {
    for(let e=a.length-1;e>0;e--) {let moved=false;for(let j=0;j<e;j++)if(compare(a[j],a[j+1])){swap(j,j+1);moved=true;}if(!moved)break;}
  } else if (id === 'quick') {
    function part(lo,hi) {if(lo>=hi)return;const p=a[hi];let i=lo;for(let j=lo;j<hi;j++)if(compare(a[j],p,'lt')) {if(i!==j)swap(i,j);i++;}if(i!==hi)swap(i,hi);part(lo,i-1);part(i+1,hi);}
    part(0,a.length-1);
  } else if (id === 'heap') {
    function sift(root,size){while(2*root+1<size){let c=2*root+1;if(c+1<size && compare(a[c],a[c+1],'lt'))c++;if(compare(a[root],a[c],'ge'))break;swap(root,c);root=c;}}
    for(let r=Math.floor(a.length/2)-1;r>=0;r--)sift(r,a.length);
    for(let e=a.length-1;e>0;e--){swap(0,e);sift(0,e);}
  } else if (id === 'merge') {
    function merge(lo,hi){if(lo>=hi)return;const mid=lo+Math.floor((hi-lo)/2);merge(lo,mid);merge(mid+1,hi);let i=lo,j=mid+1;const temp=[];while(i<=mid&&j<=hi){temp.push(compare(a[i],a[j],'le')?a[i++]:a[j++]);stats.writes++;}while(i<=mid){temp.push(a[i++]);stats.writes++;}while(j<=hi){temp.push(a[j++]);stats.writes++;}temp.forEach((v,k)=>{a[lo+k]=v;stats.writes++;});}
    merge(0,a.length-1);
  } else if (id === 'radix' && a.length) {
    for(let exp=1;exp<=100;exp*=10){const buckets=Array.from({length:10},()=>[]);for(const v of a){buckets[Math.floor(v/exp)%10].push(v);stats.writes++;}let k=0;for(const b of buckets)for(const v of b){a[k++]=v;stats.writes++;}}
  }
  return { a, stats };
}
let cases=0, framesCount=0;
for (const module of Object.values(context.SortModules)) {
  for (let n=0;n<=20;n++) for(let repeat=0;repeat<25;repeat++) {
    const input = Array.from({length:n},(_,i)=>repeat===0?0:repeat===1?i:repeat===2?n-i:repeat===3?999:Math.floor(Math.random()*1000));
    const frames=module.run(input), final=frames.at(-1), expected=reference(module.id,input);
    assert.deepStrictEqual(Array.from(final.arr,r=>r.v),expected.a,module.id+' final array');
    assert.strictEqual(new Set(Array.from(final.arr,r=>r.id)).size,n,module.id+' record identities');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(final.stats)),expected.stats,module.id+' counters '+input);
    if(context.SortLessons[module.id].stable) for(let j=1;j<n;j++) if(final.arr[j-1].v===final.arr[j].v)assert(final.arr[j-1].id<final.arr[j].id,module.id+' stability');
    let previous={comparisons:0,writes:0,swaps:0};
    for(const f of frames){
      for(const line of f.lines)assert(Number.isInteger(line)&&line>=1&&line<=module.code.length,module.id+' line number');
      for(const field of ['active','changed','sorted','ordered'])for(const index of f[field])assert(index>=0&&index<n,module.id+' invalid '+field+' index');
      for(const index of f.sorted)assert.strictEqual(f.arr[index].id,final.arr[index].id,module.id+' premature sorted position');
      const ordered=f.ordered;for(let j=1;j<ordered.length;j++)if(ordered[j]===ordered[j-1]+1)assert(f.arr[ordered[j-1]].v<=f.arr[ordered[j]].v,module.id+' incorrect ordered range');
      for(const k of ['comparisons','writes','swaps'])assert(f.stats[k]>=previous[k],module.id+' decreasing counters');
      previous=f.stats;framesCount++;
    }
    cases++;
  }
}
const seen=new Set();
for(const q of context.SortQuiz){assert(!seen.has(q.id),'duplicate quiz id');seen.add(q.id);assert(q.correct>=0&&q.correct<q.options.length,'quiz correct answer bounds');assert(q.alg==='all'||context.SortModules[q.alg],'quiz algorithm');}
console.log('PASS: '+cases+' real-Trace cases, '+framesCount+' frames; all final values, identities, stability, exact counters, line references, ordered ranges, and fixed sorted positions verified.');
for(const n of [8,16,20]){const f=context.SortModules.heap.run(Array(n).fill(7)).at(-1);console.log('Heap all equal n='+n+': '+JSON.stringify(f.stats));}
