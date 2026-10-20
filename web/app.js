(function () {
  'use strict';
  const ids = ['insertion', 'binary', 'shell', 'bubble', 'quick', 'heap', 'merge', 'radix'];
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const readStorage = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (_) { return fallback; } };
  const saveStorage = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} };
  const state = {id:'insertion', values:[42,17,8,33,21,17,9,28], frames:[], index:0, playing:false, timer:null, view:'lab', mastery:readStorage('sorting-lab-mastery-v1', []), answers:readStorage('sorting-lab-quiz-v1', {})};
  if (!Array.isArray(state.mastery)) state.mastery = [];
  if (!state.answers || typeof state.answers !== 'object' || Array.isArray(state.answers)) state.answers = {};
  let toastTimer;
  function toast(message) { $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2400); }
  function showDialog(html) { $('dialog-content').innerHTML = html; if (!$('info-dialog').open) $('info-dialog').showModal(); }
  function renderNav() {
    const groups = {0:'插入排序',3:'交换排序',5:'选择排序',6:'其他排序'};
    $('algorithm-nav').innerHTML = ids.map((id, i) => (groups[i] ? '<div class="nav-group">'+groups[i]+'</div>' : '') + '<button class="algorithm-link '+(state.id===id?'active':'')+'" data-algorithm="'+id+'" '+(state.id===id?'aria-current="page"':'')+'><span class="nav-num">'+String(i+1).padStart(2,'0')+'</span><span>'+escape(SortModules[id].name)+'</span><span class="nav-check">'+(state.mastery.includes(id)?'✓':'')+'</span></button>').join('');
    $('mastery-count').textContent = state.mastery.filter(id=>ids.includes(id)).length+' / 8';
    $('mastery-fill').style.width = state.mastery.filter(id=>ids.includes(id)).length / 8 * 100 + '%';
    const mastered = state.mastery.includes(state.id);
    $('mastery-button').classList.toggle('is-mastered', mastered);
    $('mastery-button').textContent = mastered ? '✓ 已掌握' : '○ 标记已掌握';
  }
  function setView(view) {
    state.view = view; if (view !== 'lab') pause();
    ['lab','compare','quiz'].forEach(v => { $(v+'-view').hidden = v !== view; document.querySelector('[data-view="'+v+'"]').setAttribute('aria-selected',String(v===view)); });
    if (view === 'quiz') renderQuiz();
  }
  function highlight(code) {
    const token = /(\/\/.*$|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b(?:void|int|long|bool|true|false|for|while|if|else|return|auto|const|size_t|vector|using|namespace|std|include|false|break|continue)\b|\b\d+\b)/g;
    let result = '', last = 0;
    for (const match of code.matchAll(token)) {
      result += escape(code.slice(last,match.index));
      const t = match[0]; const cls = t.startsWith('//')?'comment':(/^["']/.test(t)?'string':(/^\d/.test(t)?'number':'keyword'));
      result += '<span class="tok-'+cls+'">'+escape(t)+'</span>'; last = match.index+t.length;
    }
    return result+escape(code.slice(last));
  }
  function selectAlgorithm(id) {
    if (!ids.includes(id)) return;
    pause(); state.id = id; const module = SortModules[id], lesson = SortLessons[id];
    $('algorithm-eyebrow').textContent = String(ids.indexOf(id)+1).padStart(2,'0')+' / '+module.en.toUpperCase();
    $('algorithm-title').innerHTML = escape(module.name)+'<span>'+escape(module.en)+'</span>';
    $('algorithm-summary').textContent = module.summary;
    $('fact-strip').innerHTML = '<div class="fact">平均时间 <strong>'+escape(lesson.average)+'</strong></div><div class="fact">最坏时间 <strong>'+escape(lesson.worst)+'</strong></div><div class="fact">额外空间 <strong>'+escape(lesson.space)+'</strong></div><div class="fact"><span class="stable-pill '+(!lesson.stable?'unstable-pill':'')+'">'+(lesson.stable?'✓ 稳定排序':'不稳定排序')+'</span></div>';
    $('code-list').innerHTML = module.code.map((line,i)=>'<div class="code-line" data-line="'+(i+1)+'"><span class="line-number">'+(i+1)+'</span><span class="code-text">'+highlight(line)+'</span></div>').join('');
    $('code-scroll').scrollTop = 0;
    $('mnemonic').textContent = lesson.mnemonic; $('lesson-idea').textContent = lesson.idea;
    $('lesson-invariant').textContent = lesson.invariant;
    $('lesson-steps').innerHTML = lesson.steps.map(s=>'<li>'+escape(s)+'</li>').join('');
    $('lesson-pitfalls').innerHTML = lesson.pitfalls.map(s=>'<li>'+escape(s)+'</li>').join('');
    $('recall-prompt').textContent = lesson.question.prompt;
    $('recall-answer').textContent = lesson.question.answer+' '+lesson.question.explanation;
    $('recall-answer').hidden = true; $('recall-toggle').textContent = '查看答案 ↓';
    $('lesson-when').textContent = '适用场景 · '+lesson.when;
    renderNav(); regenerate(); setView('lab'); $('sidebar').classList.remove('open');
    document.title = module.name+' · 排序研习室';
  }
  function regenerate() {
    pause(); state.frames = SortModules[state.id].run([...state.values]); state.index = 0;
    $('timeline').max = Math.max(0,state.frames.length-1); $('chart').innerHTML = '';
    renderFrame();
  }
  function renderChart(frame) {
    const chart = $('chart'), n = frame.arr.length, max = Math.max(...state.values,1);
    chart.classList.toggle('dense',n>12);
    if (chart.children.length !== n) chart.innerHTML = frame.arr.map((_,i)=>'<div class="bar-slot"><div class="bar"><span class="bar-value"></span><span class="pointer-label"></span><span class="bar-index">'+i+'</span></div></div>').join('');
    const pointerEntries = Object.entries(frame.pointers || {});
    frame.arr.forEach((item,i) => {
      const bar = chart.children[i].firstElementChild;
      bar.className = 'bar'+(frame.ordered?.includes(i)?' ordered':'')+(frame.sorted?.includes(i)?' sorted':'')+(frame.active?.includes(i)?' active':'')+(frame.changed?.includes(i)?' changed':'');
      bar.style.setProperty('--height',Math.max(8,item.v/max*93)+'%');
      bar.style.opacity = frame.range && (i<frame.range[0]||i>frame.range[1]) && !frame.sorted?.includes(i) ? '.4' : '1';
      bar.querySelector('.bar-value').innerHTML = escape(item.v)+($('show-tags').checked?'<sup>'+escape(String.fromCharCode(97+item.id))+'</sup>':'');
      bar.querySelector('.pointer-label').textContent = pointerEntries.filter(([,index])=>index===i).map(([name])=>name).join('·');
      bar.parentElement.setAttribute('aria-label','下标 '+i+'，值 '+item.v+'，原始序号 '+String.fromCharCode(97+item.id)+(frame.sorted?.includes(i)?'，已就位':''));
    });
  }
  const auxChip = item => '<span class="aux-item">'+escape(typeof item === 'object'?item.v:item)+(typeof item==='object'&&$('show-tags').checked?'<sup>'+escape(String.fromCharCode(97+item.id))+'</sup>':'')+'</span>';
  function renderSpecial(frame) {
    const target = $('special-visual');
    if (Array.isArray(frame.buckets)) {
      target.hidden = false;
      target.innerHTML = '<div class="special-heading"><span>按当前位分配 → 按桶 0～9 稳定收集</span><span>桶内保持先后顺序</span></div><div class="bucket-row">'+frame.buckets.map((bucket,i)=>'<div class="bucket"><div class="bucket-items">'+bucket.map(item=>'<div class="bucket-item">'+escape(typeof item==='object'?item.v:item)+(typeof item==='object'&&$('show-tags').checked?'<sup>'+String.fromCharCode(97+item.id)+'</sup>':'')+'</div>').join('')+'</div><div class="bucket-digit">'+i+'</div></div>').join('')+'</div>';
    } else if (typeof frame.heapSize === 'number' && frame.heapSize > 0) {
      const n=frame.heapSize, levels=Math.floor(Math.log2(n))+1, h=Math.max(120,levels*34+8), w=480;
      const pos=i=>{const d=Math.floor(Math.log2(i+1)), first=2**d-1;return {x:(i-first+.5)*w/2**d,y:18+d*34};};
      let svg='';
      for(let i=1;i<n;i++){const p=pos(Math.floor((i-1)/2)),c=pos(i);svg+='<line x1="'+p.x+'" y1="'+p.y+'" x2="'+c.x+'" y2="'+c.y+'"/>';}
      for(let i=0;i<n;i++){const p=pos(i);svg+='<circle cx="'+p.x+'" cy="'+p.y+'" r="12" class="'+(frame.changed?.includes(i)?'node-changed':frame.active?.includes(i)?'node-active':'')+'"/><text x="'+p.x+'" y="'+p.y+'">'+frame.arr[i].v+'</text><text class="heap-index" x="'+(p.x+16)+'" y="'+(p.y+10)+'">'+i+'</text>';}
      target.hidden=false;target.innerHTML='<div class="special-heading"><span>当前完全二叉树 · 堆区间 [0, '+(n-1)+']</span><span>左右孩子：2i+1 / 2i+2</span></div><svg class="heap-svg" style="height:'+h+'px" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="当前堆区间的完全二叉树">'+svg+'</svg>';
    } else if (Array.isArray(frame.aux) && frame.aux.length) {
      target.hidden = false; target.innerHTML = '<div class="special-heading"><span>'+(state.id==='merge'?'辅助数组 · 合并结果':'暂存区 · 等待插入的元素')+'</span><span>避免移动时丢失关键字</span></div><div class="aux-array">'+frame.aux.map(auxChip).join('')+'</div>';
    } else { target.hidden=true; target.innerHTML=''; }
  }
  function renderFrame() {
    const frame=state.frames[state.index]; if(!frame) return;
    renderChart(frame); renderSpecial(frame);
    $('phase-label').textContent = frame.phase || (state.index===state.frames.length-1?'排序完成':state.index===0?'准备开始':'演示中');
    $('step-title').textContent=frame.title; $('step-note').textContent=frame.note;
    $('step-number').textContent=String(state.index+1).padStart(2,'0');
    $('step-counter').textContent=String(state.index+1).padStart(2,'0')+' / '+String(state.frames.length).padStart(2,'0')+' 步';
    $('timeline').value=state.index;
    $('comparisons-count').textContent=frame.stats.comparisons;
    $('writes-count').textContent=frame.stats.writes; $('swaps-count').textContent=frame.stats.swaps;
    $('variables').innerHTML=Object.entries(frame.vars||{}).map(([k,v])=>'<span class="variable">'+escape(k)+' = <b>'+escape(typeof v==='object'?v.v??JSON.stringify(v):v)+'</b></span>').join('');
    document.querySelectorAll('.code-line.current').forEach(line=>line.classList.remove('current'));
    (frame.lines||[]).forEach(line=>$('code-list').children[line-1]?.classList.add('current'));
    $('code-location').textContent=frame.lines?.length?'当前执行 · 第 '+frame.lines.join(', ')+' 行':state.index===state.frames.length-1?'全部步骤执行完毕':'准备执行';
    if($('follow-code').checked&&frame.lines?.length){
      const active=$('code-list').children[frame.lines[0]-1], scroller=$('code-scroll');
      if(active){const y=active.offsetTop-$('code-list').offsetTop;if(y<scroller.scrollTop+30||y>scroller.scrollTop+scroller.clientHeight-65)scroller.scrollTo({top:Math.max(0,y-scroller.clientHeight*.4),behavior:'auto'});}
    }
    $('prev-button').disabled=state.index===0; $('next-button').disabled=state.index===state.frames.length-1;
    $('reset-button').disabled=state.index===0; $('end-button').disabled=state.index===state.frames.length-1;
    $('timeline-status').textContent=state.index===state.frames.length-1?'排序完成':'← / → 单步 · 空格播放 / 暂停';
    $('play-button').textContent=state.playing?'Ⅱ 暂停演示':state.index===state.frames.length-1?'↺ 重新播放':'▶ 播放演示';
  }
  function pause(){clearTimeout(state.timer);state.playing=false;if($('play-button'))$('play-button').textContent=state.index===state.frames.length-1?'↺ 重新播放':'▶ 播放演示';}
  function jump(index){pause();state.index=Math.max(0,Math.min(state.frames.length-1,index));renderFrame();}
  function tick(){if(!state.playing)return;if(state.index>=state.frames.length-1){pause();renderFrame();return;}state.index++;renderFrame();state.timer=setTimeout(tick,1000/Number($('speed-select').value));}
  function togglePlay(){if(state.playing){pause();return;}if(state.index===state.frames.length-1)state.index=0;state.playing=true;renderFrame();state.timer=setTimeout(tick,800/Number($('speed-select').value));}
  function applyValues(values){state.values=values;$('array-input').value=values.join(', ');$('input-error').textContent='';regenerate();}
  function codeText(){const functions={insertion:'insertionSort',binary:'binaryInsertionSort',shell:'shellSort',bubble:'bubbleSort',quick:'quickSort',heap:'heapSort',merge:'mergeSort',radix:'radixSort'};return '// '+SortModules[state.id].name+' | C++17\n#include <algorithm>\n#include <iostream>\n#include <vector>\nusing namespace std;\n\n'+SortModules[state.id].code.join('\n')+'\n\nint main() {\n    vector<int> a = {'+state.values.join(', ')+'};\n    '+functions[state.id]+'(a);\n    for (int x : a) cout << x << \' \';\n    cout << \'\\n\';\n    return 0;\n}\n';}
  function downloadText(text,filename,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  function renderCompare(){
    $('compare-body').innerHTML=ids.map((id,i)=>{const l=SortLessons[id];return '<tr><td><button data-learn="'+id+'"><span>'+String(i+1).padStart(2,'0')+'</span>'+escape(SortModules[id].name)+' ↗</button></td><td>'+escape(l.best)+'</td><td>'+escape(l.average)+'</td><td>'+escape(l.worst)+'</td><td>'+escape(l.space)+'</td><td><span class="'+(l.stable?'yes-pill':'no-pill')+'">'+(l.stable?'稳定':'不稳定')+'</span></td><td><span class="'+(l.inPlace?'yes-pill':'no-pill')+'">'+(l.inPlace?'是':'否')+'</span></td></tr>';}).join('');
    $('compare-notes').innerHTML=ids.filter(id=>['binary','shell','quick','heap','radix'].includes(id)).map(id=>'<div><b>'+escape(SortModules[id].name)+'：</b>'+escape(SortLessons[id].complexityNote)+'</div>').join('')+'<div><b>口径：</b>本页原地指数据重排不使用线性辅助数组；递归栈仍计入额外空间。* 堆排序最好时间针对本实现的全相等输入；教材常见 O(n log n) 口径见注。</div>';
  }
  function quizSet(){const filter=$('quiz-filter').value;return SortQuiz.filter(q=>filter==='all'||q.alg===filter);}
  function renderQuiz(){
    const questions=quizSet(), answered=questions.filter(q=>Number.isInteger(state.answers[q.id])), correct=answered.filter(q=>state.answers[q.id]===q.correct);
    $('quiz-progress').textContent=answered.length+' / '+questions.length+' 已答 · '+correct.length+' 正确';
    $('quiz-content').innerHTML=(answered.length===questions.length&&questions.length?'<div class="quiz-result"><h2>'+correct.length+' / '+questions.length+' 答对</h2><p>'+(correct.length===questions.length?'本组题目已全部答对。':'可查看错题解析，复习循环边界、相等元素处理和时间复杂度。')+'</p></div>':'')+questions.map((q,i)=>{
      const answer=state.answers[q.id],done=Number.isInteger(answer),isCorrect=answer===q.correct;
      return '<article class="card quiz-card"><div class="quiz-question-header"><span>'+String(i+1).padStart(2,'0')+'</span><span>/ '+questions.length+'</span><span>· '+escape(q.alg==='all'?'综合辨析':SortModules[q.alg]?.name||'综合辨析')+'</span></div><h2>'+escape(q.prompt)+'</h2><div class="quiz-options">'+q.options.map((option,j)=>'<button class="quiz-option '+(done&&j===q.correct?'correct':done&&j===answer?'wrong':'')+'" data-question="'+escape(q.id)+'" data-answer="'+j+'" '+(done?'disabled':'')+'><span>'+String.fromCharCode(65+j)+'</span>'+escape(option)+(done&&j===q.correct?' ✓':'')+'</button>').join('')+'</div>'+(done?'<div class="quiz-feedback '+(!isCorrect?'incorrect':'')+'"><strong>'+(isCorrect?'✓ 回答正确':'× 回答错误 · 正确答案是 '+String.fromCharCode(65+q.correct))+'</strong>'+escape(q.explanation)+(ids.includes(q.alg)?'<button data-learn="'+q.alg+'">回到'+escape(SortModules[q.alg].name)+'推演 →</button>':'')+'</div>':'')+'</article>';
    }).join('');
  }
  function showPlan(){showDialog('<div class="eyebrow">REVIEW PLAN</div><h2>60 分钟复习计划</h2><p>点击算法名称打开演示；复习进度可在演示页手动标记。</p>'+SortPlan.map(p=>'<div class="plan-item"><strong>'+p.minutes+'<small>MINUTES</small></strong><div><h3>'+escape(p.title)+'</h3><p>'+escape(p.detail)+'</p>'+p.algorithms.map(id=>'<button data-plan-algorithm="'+id+'">'+escape(SortModules[id].name)+' →</button>').join('')+'</div></div>').join(''));}
  $('algorithm-nav').addEventListener('click',e=>{const b=e.target.closest('[data-algorithm]');if(b)selectAlgorithm(b.dataset.algorithm);});
  document.querySelector('.tabs').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)setView(b.dataset.view);});
  document.addEventListener('click',e=>{const b=e.target.closest('[data-learn]');if(b){selectAlgorithm(b.dataset.learn);window.scrollTo({top:0,behavior:'smooth'});}});
  $('mastery-button').addEventListener('click',()=>{state.mastery=state.mastery.includes(state.id)?state.mastery.filter(id=>id!==state.id):[...state.mastery,state.id];saveStorage('sorting-lab-mastery-v1',state.mastery);renderNav();});
  $('play-button').addEventListener('click',togglePlay);$('prev-button').addEventListener('click',()=>jump(state.index-1));$('next-button').addEventListener('click',()=>jump(state.index+1));$('reset-button').addEventListener('click',()=>jump(0));$('end-button').addEventListener('click',()=>jump(state.frames.length-1));
  $('timeline').addEventListener('input',e=>jump(Number(e.target.value)));$('show-tags').addEventListener('change',renderFrame);$('follow-code').addEventListener('change',renderFrame);
  $('speed-select').addEventListener('change',()=>{if(state.playing){clearTimeout(state.timer);state.timer=setTimeout(tick,1000/Number($('speed-select').value));}});
  $('array-form').addEventListener('submit',e=>{e.preventDefault();const raw=$('array-input').value.trim(),tokens=raw.split(/[\s,，、;；]+/).filter(Boolean);if(tokens.length<3||tokens.length>20){$('input-error').textContent='请输入 3～20 个整数，用逗号或空格分隔。';return;}if(tokens.some(x=>!/^\d+$/.test(x)||Number(x)>999)){$('input-error').textContent='每个元素应为 0～999 的整数，例如：42, 17, 8, 33。';return;}applyValues(tokens.map(Number));toast('数据已更新，演示已回到第一步');});
  $('presets').addEventListener('click',e=>{const b=e.target.closest('[data-preset]');if(!b)return;const n=state.values.length;let values;if(b.dataset.preset==='random')values=Array.from({length:n},()=>Math.floor(Math.random()*90)+5);if(b.dataset.preset==='sorted')values=[...state.values].sort((a,b)=>a-b);if(b.dataset.preset==='reverse')values=[...state.values].sort((a,b)=>b-a);if(b.dataset.preset==='duplicates')values=Array.from({length:n},(_,i)=>[28,17,28,9,17,9,28,17][i%8]);applyValues(values);});
  $('copy-code').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(codeText());toast('C++ 代码已复制，包含所需头文件');}catch(_){showDialog('<h2>复制 C++ 代码</h2><p>当前浏览器不允许直接访问剪贴板。可选择下方代码复制，或使用「↓ .cpp」下载。</p><textarea id="copy-fallback" style="width:100%;height:280px;font:11px monospace;border:1px solid #d7e3cb;padding:12px" readonly>'+escape(codeText())+'</textarea>');$('copy-fallback').select();}});
  $('download-code').addEventListener('click',async()=>{if(window.SortDesktop?.saveCpp){if(await window.SortDesktop.saveCpp(codeText(),state.id+'-sort.cpp'))toast('C++ 示例已保存');return;}downloadText(codeText(),state.id+'-sort.cpp','text/x-c++src;charset=utf-8');toast('正在导出 C++17 程序');});
  $('recall-toggle').addEventListener('click',()=>{const answer=$('recall-answer');answer.hidden=!answer.hidden;$('recall-toggle').textContent=answer.hidden?'查看答案 ↓':'收起答案 ↑';});
  $('quiz-current').addEventListener('click',()=>{$('quiz-filter').value=state.id;setView('quiz');window.scrollTo({top:0,behavior:'smooth'});});
  $('quiz-filter').addEventListener('change',renderQuiz);
  $('quiz-reset').addEventListener('click',()=>{quizSet().forEach(q=>delete state.answers[q.id]);saveStorage('sorting-lab-quiz-v1',state.answers);renderQuiz();toast('已重置当前范围的练习');});
  $('quiz-content').addEventListener('click',e=>{const b=e.target.closest('[data-question]');if(!b)return;state.answers[b.dataset.question]=Number(b.dataset.answer);saveStorage('sorting-lab-quiz-v1',state.answers);const y=window.scrollY;renderQuiz();window.scrollTo(0,y);});
  $('help-button').addEventListener('click',()=>showDialog('<div class="eyebrow">USER GUIDE</div><h2>操作说明</h2><ul><li>先选算法，用「下一步」观察一次比较或移动对应哪行代码。</li><li>用空格播放 / 暂停，用左右方向键单步推演；Home 回到开始，End 跳到结果。</li><li>橙色表示比较，珊瑚色表示写入或交换，浅绿表示局部有序，深绿表示最终位置已确定。</li><li>原始序号 a、b、c… 跟随元素身份；相等值若交换了先后次序，就能观察到不稳定性。</li><li>移动时数组可能短暂出现重复身份，原元素此时保存在暂存区；写回后恢复完整排列。</li><li>演示下方有回忆题；“自测练习”页可选择答案并查看解析。</li></ul><p>掌握标记与答题进度保存在当前浏览器；此网页无需登录或联网计算。</p>'));
  $('counter-help').addEventListener('click',()=>showDialog('<h2>计数说明</h2><p>关键字比较：只计元素大小比较，不计循环条件和下标边界判断。基数排序按位分配，不进行关键字之间的大小比较。</p><p>数组写入：包含主数组及辅助数组、桶中的元素写入。暂存标量与桶清空不计。每次交换计两次主数组写入，交换次数另外记录。</p><p>这些计数用于理解当前实现和输入的过程。它们不等于运行时间，也不能直接当作所有实现之间的性能排名。</p>'));
  $('plan-button').addEventListener('click',showPlan);$('dialog-content').addEventListener('click',e=>{const b=e.target.closest('[data-plan-algorithm]');if(b){$('info-dialog').close();selectAlgorithm(b.dataset.planAlgorithm);}});
  document.querySelector('.dialog-close').addEventListener('click',()=>$('info-dialog').close());$('info-dialog').addEventListener('click',e=>{if(e.target===$('info-dialog')){const r=$('info-dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('info-dialog').close();}});
  $('mobile-menu').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
  document.addEventListener('click',e=>{if($('sidebar').classList.contains('open')&&!e.target.closest('#sidebar')&&!e.target.closest('#mobile-menu'))$('sidebar').classList.remove('open');});
  document.addEventListener('keydown',e=>{if(state.view!=='lab'||$('info-dialog').open||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(e.code==='Space'&&e.target.tagName!=='BUTTON'){e.preventDefault();togglePlay();}if(e.key==='ArrowRight'){e.preventDefault();jump(state.index+1);}if(e.key==='ArrowLeft'){e.preventDefault();jump(state.index-1);}if(e.key==='Home'){e.preventDefault();jump(0);}if(e.key==='End'){e.preventDefault();jump(state.frames.length-1);}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  $('quiz-filter').innerHTML+=ids.map(id=>'<option value="'+id+'">'+escape(SortModules[id].name)+'</option>').join('');$('quiz-badge').textContent=SortQuiz.length;
  renderCompare();selectAlgorithm(state.id);
  window.SortLab = {getState:()=>({id:state.id,index:state.index,total:state.frames.length,values:[...state.values],frame:state.frames[state.index]}),selectAlgorithm,jump,applyValues};
})();
