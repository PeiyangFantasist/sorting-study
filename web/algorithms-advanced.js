(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const modules = root.SortModules || (root.SortModules = {});
  const indices = (lo, hi) => Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => lo + i);

  modules.quick = {
    id: 'quick', name: '快速排序', en: 'Quick Sort', category: '交换排序',
    summary: '取区间末尾元素为基准，以 i 划分“小于基准”和“尚未检查”区域。一次划分只确定基准的最终位置，再递归处理两侧。',
    code: [
      'void quickSortRange(vector<int>& a, int lo, int hi) {',
      '    if (lo >= hi) return;',
      '    int pivot = a[hi], i = lo;',
      '    for (int j = lo; j < hi; ++j) {',
      '        if (a[j] < pivot) {',
      '            if (i != j) swap(a[i], a[j]);',
      '            ++i;',
      '        }',
      '    }',
      '    if (i != hi) swap(a[i], a[hi]);',
      '    quickSortRange(a, lo, i - 1);',
      '    quickSortRange(a, i + 1, hi);',
      '}',
      'void quickSort(vector<int>& a) {',
      '    quickSortRange(a, 0, (int)a.size() - 1);',
      '}'
    ],
    run(values) {
      const t = new root.Trace(values);
      const fixed = new Set();
      const snapshot = (extra = {}) => ({ sorted: [...fixed], ...extra });
      t.emit([14, 15], '准备进行递归划分', '本演示使用 Lomuto 划分，固定取末尾元素作基准。逆序或全相等输入可能反复产生极不均衡的划分，退化为 O(n²)。', { vars: { n: t.a.length } });
      function partition(lo, hi, depth) {
        if (lo > hi) return;
        if (lo === hi) {
          fixed.add(lo);
          t.emit([2], `区间 [${lo}, ${hi}] 只有一个元素`, '它已处于最终位置，递归在这里返回。', snapshot({ range: [lo, hi], vars: { lo, hi, depth } }));
          return;
        }
        const pivot = t.a[hi];
        let i = lo;
        t.emit([3], `选择末尾基准 pivot = ${pivot.v}`, `维护 a[${lo}..i-1] < pivot，a[i..j-1] ≥ pivot。i 指向下一个“小于基准”元素应放入的位置。`, snapshot({ range: [lo, hi], active: [hi], pointers: { i, pivot: hi }, vars: { lo, hi, i, pivot: pivot.v, depth } }));
        for (let j = lo; j < hi; ++j) {
          ++t.comparisons;
          const smaller = t.a[j].v < pivot.v;
          t.emit([4, 5], `比较 a[${j}] = ${t.a[j].v} 与基准 ${pivot.v}`, smaller ? `${t.a[j].v} < ${pivot.v}，将它放入左侧“小于基准”的区域。` : `${t.a[j].v} ≥ ${pivot.v}，留在右侧区域，i 不变。相等元素也走这一分支。`, snapshot({ range: [lo, hi], active: [j, hi], pointers: { i, j, pivot: hi }, vars: { lo, hi, i, j, pivot: pivot.v, depth } }));
          if (smaller) {
            const dest = i;
            if (i !== j) t.swap(i, j);
            ++i;
            t.emit([6, 7], dest === j ? `左区间扩展到 a[${dest}]` : `交换 a[${dest}] 与 a[${j}]，扩展左区间`, dest === j ? '该元素原本就在应放的位置，无需交换；i 向右移动一格。' : '较小元素进入左区间，然后 i 向右移动。交换可能改变相等元素的相对顺序，因此快速排序不稳定。', snapshot({ range: [lo, hi], changed: dest === j ? [] : [dest, j], active: [dest], pointers: { i, j, pivot: hi }, vars: { lo, hi, i, j, pivot: pivot.v, depth } }));
          }
        }
        if (i !== hi) t.swap(i, hi);
        fixed.add(i);
        t.emit([10], `基准 ${pivot.v} 归位到 a[${i}]`, `左侧都小于 ${pivot.v}，右侧都大于或等于它。基准已在最终位置；两侧各自还需要继续排序。`, snapshot({ range: [lo, hi], changed: i === hi ? [] : [i, hi], active: [i], pointers: { pivot: i }, vars: { lo, hi, split: i, depth } }));
        t.emit([11], `递归处理左区间 [${lo}, ${i - 1}]`, i > lo ? '只在基准左侧重新选择基准并划分，已经归位的元素不再参与。' : '左区间为空，直接返回。', snapshot({ range: [lo, hi], vars: { lo, hi, nextLo: lo, nextHi: i - 1, depth } }));
        partition(lo, i - 1, depth + 1);
        t.emit([12], `递归处理右区间 [${i + 1}, ${hi}]`, i < hi ? '继续处理基准右侧；每次划分都会确定一个基准的位置。' : '右区间为空，直接返回。', snapshot({ range: [lo, hi], vars: { lo, hi, nextLo: i + 1, nextHi: hi, depth } }));
        partition(i + 1, hi, depth + 1);
      }
      partition(0, t.a.length - 1, 0);
      return t.done();
    }
  };

  modules.heap = {
    id: 'heap', name: '堆排序', en: 'Heap Sort', category: '选择排序',
    summary: '先自底向上建立大根堆，再把堆顶最大值交换到末尾，缩小堆并向下调整。数组下标与完全二叉树结点一一对应。',
    code: [
      'void siftDown(vector<int>& a, int root, int size) {',
      '    while (2 * root + 1 < size) {',
      '        int child = 2 * root + 1;',
      '        if (child + 1 < size && a[child] < a[child + 1])',
      '            ++child;',
      '        if (a[root] >= a[child]) break;',
      '        swap(a[root], a[child]);',
      '        root = child;',
      '    }',
      '}',
      'void heapSort(vector<int>& a) {',
      '    int n = (int)a.size();',
      '    for (int root = n / 2 - 1; root >= 0; --root)',
      '        siftDown(a, root, n);',
      '    for (int end = n - 1; end > 0; --end) {',
      '        swap(a[0], a[end]);',
      '        siftDown(a, 0, end);',
      '    }',
      '}'
    ],
    run(values) {
      const t = new root.Trace(values), n = t.a.length;
      let heapSize = n;
      const snapshot = (extra = {}) => ({ heapSize, sorted: indices(heapSize, n - 1), range: [0, Math.max(0, heapSize - 1)], ...extra });
      t.emit([11, 12], '把数组看作一棵完全二叉树', '下标从 0 开始：左孩子为 2 × root + 1，右孩子为 2 × root + 2。大根堆只要求父结点不小于孩子，并不表示数组整体有序。', snapshot({ vars: { n, heapSize } }));
      function siftDown(start, size, phase) {
        let parent = start;
        while (2 * parent + 1 < size) {
          let child = 2 * parent + 1;
          t.emit([2, 3], `检查结点 a[${parent}] 的孩子`, '先选左孩子；如果存在右孩子，再比较两个孩子的大小。', snapshot({ active: [parent, child], pointers: { root: parent, child }, vars: { root: parent, child, size, phase } }));
          if (child + 1 < size) {
            ++t.comparisons;
            const rightLarger = t.a[child].v < t.a[child + 1].v;
            t.emit([4], `比较两个孩子 ${t.a[child].v} 与 ${t.a[child + 1].v}`, rightLarger ? '右孩子更大，接下来应与右孩子比较。' : '左孩子不小于右孩子，继续使用左孩子。', snapshot({ active: [child, child + 1], pointers: { root: parent, child }, vars: { root: parent, child, size, phase } }));
            if (rightLarger) {
              ++child;
              t.emit([5], `选中较大的孩子 a[${child}]`, '向下调整必须与较大的孩子交换，才能同时满足两条父子关系。', snapshot({ active: [child], pointers: { root: parent, child }, vars: { root: parent, child, size, phase } }));
            }
          }
          ++t.comparisons;
          const stop = t.a[parent].v >= t.a[child].v;
          t.emit([6], `比较父结点 ${t.a[parent].v} 与较大孩子 ${t.a[child].v}`, stop ? '父结点已经不小于较大孩子，这棵子树满足大根堆条件，停止下沉。' : '父结点小于孩子，需要交换并继续向下检查。', snapshot({ active: [parent, child], pointers: { root: parent, child }, vars: { root: parent, child, size, phase } }));
          if (stop) break;
          const previous = parent;
          t.swap(parent, child);
          parent = child;
          t.emit([7, 8], `交换 a[${previous}] 与 a[${child}]`, '较大孩子上升，原父结点下沉到孩子位置，再检查它的新孩子。', snapshot({ changed: [previous, child], pointers: { root: parent, child }, vars: { root: parent, child, size, phase } }));
        }
      }
      for (let parent = Math.floor(n / 2) - 1; parent >= 0; --parent) {
        t.emit([13, 14], `自底向上建堆：调整 a[${parent}]`, '叶子已经是单结点堆。从最后一个非叶结点开始，依次向前调整，建堆总时间为 O(n)。', snapshot({ active: [parent], pointers: { root: parent }, vars: { root: parent, size: n, phase: '建堆' } }));
        siftDown(parent, n, '建堆');
      }
      t.emit([15], '大根堆建立完成', n ? `堆顶 ${t.a[0].v} 是当前最大值；接下来将它送到数组末尾。` : '空数组无需继续处理。', snapshot({ active: n ? [0] : [], vars: { size: n, phase: '取堆顶' } }));
      for (let end = n - 1; end > 0; --end) {
        t.swap(0, end);
        heapSize = end;
        t.emit([15, 16], `最大值 ${t.a[end].v} 归位到 a[${end}]`, `堆的有效范围缩小为 [0, ${end - 1}]。右侧绿色后缀已在最终位置，不再进入堆。`, snapshot({ changed: [0, end], pointers: { root: 0, end }, vars: { end, size: end, phase: '取堆顶' } }));
        t.emit([17], '修复缩小后的大根堆', '只有根结点可能破坏堆性质；从根开始向下调整即可。', snapshot({ active: [0], pointers: { root: 0 }, vars: { size: end, phase: '调整堆' } }));
        siftDown(0, end, '调整堆');
      }
      const frames = t.done();
      frames[frames.length - 1].heapSize = 0;
      return frames;
    }
  };

  modules.merge = {
    id: 'merge', name: '归并排序', en: 'Merge Sort', category: '归并排序',
    summary: '递归把区间一分为二，再用双指针合并两个有序段。相等时优先从左段取出（≤），从而保持稳定性；需要 O(n) 辅助空间。',
    code: [
      'void mergeRange(vector<int>& a, int lo, int hi, vector<int>& temp) {',
      '    if (lo >= hi) return;',
      '    int mid = lo + (hi - lo) / 2;',
      '    mergeRange(a, lo, mid, temp);',
      '    mergeRange(a, mid + 1, hi, temp);',
      '    int i = lo, j = mid + 1, k = lo;',
      '    while (i <= mid && j <= hi) {',
      '        if (a[i] <= a[j]) temp[k++] = a[i++];',
      '        else temp[k++] = a[j++];',
      '    }',
      '    while (i <= mid) temp[k++] = a[i++];',
      '    while (j <= hi) temp[k++] = a[j++];',
      '    for (int p = lo; p <= hi; ++p) a[p] = temp[p];',
      '}',
      'void mergeSort(vector<int>& a) {',
      '    vector<int> temp(a.size());',
      '    mergeRange(a, 0, (int)a.size() - 1, temp);',
      '}'
    ],
    run(values) {
      const t = new root.Trace(values), n = t.a.length;
      const temp = new Array(n);
      t.emit([15, 16, 17], '准备辅助数组并递归分解', '先分解，后合并。辅助区只显示本轮已经写入的 temp[lo..k-1]；统计中的“写入”同时包含辅助数组和主数组的写入。', { vars: { n } });
      function mergeRange(lo, hi, depth) {
        if (lo >= hi) {
          if (lo === hi) t.emit([2], `区间 [${lo}, ${hi}] 已不可再分`, '单个元素天然有序，返回上层进行合并；它的最终下标还可能改变。', { range: [lo, hi], ordered: [lo], vars: { lo, hi, depth } });
          return;
        }
        const mid = lo + Math.floor((hi - lo) / 2);
        t.emit([3, 4], `拆分 [${lo}, ${hi}]，先处理左半段`, `mid = ${mid}。左半段为 [${lo}, ${mid}]，右半段为 [${mid + 1}, ${hi}]。`, { range: [lo, hi], pointers: { lo, mid, hi }, vars: { lo, mid, hi, depth } });
        mergeRange(lo, mid, depth + 1);
        t.emit([5], `左半段有序，处理右半段 [${mid + 1}, ${hi}]`, '左右两半必须各自有序，才能使用双指针线性合并。', { range: [lo, hi], ordered: indices(lo, mid), vars: { lo, mid, hi, depth } });
        mergeRange(mid + 1, hi, depth + 1);
        let i = lo, j = mid + 1, k = lo;
        const snapshot = (extra = {}) => ({ range: [lo, hi], aux: temp.slice(lo, k), pointers: { i, j, k }, vars: { lo, mid, hi, i, j, k, depth, bufferStart: lo }, ...extra });
        t.emit([6], `合并两个有序段 [${lo}, ${mid}] 和 [${mid + 1}, ${hi}]`, `i 指向左段，j 指向右段，k 是辅助数组的下一写入位置。此处辅助区第 0 格对应 temp[${lo}]。`, snapshot());
        while (i <= mid && j <= hi) {
          ++t.comparisons;
          const takeLeft = t.a[i].v <= t.a[j].v;
          t.emit([7, 8], `比较左侧 ${t.a[i].v} 与右侧 ${t.a[j].v}`, takeLeft ? (t.a[i].v === t.a[j].v ? '两者相等，优先取左半段元素。这个 ≤ 是归并排序稳定的关键。' : '左侧更小，先写入辅助区。') : '右侧更小，先写入辅助区。', snapshot({ active: [i, j] }));
          const source = takeLeft ? i++ : j++;
          temp[k++] = t.a[source];
          ++t.writes;
          t.emit([takeLeft ? 8 : 9], `把 ${t.a[source].v} 写入 temp[${k - 1}]`, '辅助区从小到大增长；取自哪一半，就只推进哪一半的指针。', snapshot({ active: [source] }));
        }
        while (i <= mid) {
          const source = i++;
          temp[k++] = t.a[source];
          ++t.writes;
          t.emit([11], `追加左半段剩余元素 ${t.a[source].v}`, '右半段已取完，左半段余下元素本来就有序，依次复制，无需再比较大小。', snapshot({ active: [source] }));
        }
        while (j <= hi) {
          const source = j++;
          temp[k++] = t.a[source];
          ++t.writes;
          t.emit([12], `追加右半段剩余元素 ${t.a[source].v}`, '左半段已取完，右半段余下元素依次复制，无需再比较大小。', snapshot({ active: [source] }));
        }
        for (let p = lo; p <= hi; ++p) {
          t.a[p] = temp[p];
          ++t.writes;
          t.emit([13], `将 temp[${p}] = ${temp[p].v} 写回 a[${p}]`, '将本轮合并结果按顺序写回原区间。辅助区仍保留结果；临时出现相同标签属于同一元素的存储副本。', snapshot({ changed: [p], pointers: { p }, ordered: indices(lo, p) }));
        }
        t.emit([14], `区间 [${lo}, ${hi}] 合并完成`, lo === 0 && hi === n - 1 ? '最外层合并完成，整个数组有序，所有位置确定。' : '这个区间现在有序，但还要与更大的相邻区间合并，所以暂不标成最终位置。', snapshot({ ordered: indices(lo, hi), sorted: lo === 0 && hi === n - 1 ? indices(0, n - 1) : [] }));
      }
      mergeRange(0, n - 1, 0);
      return t.done();
    }
  };

  modules.radix = {
    id: 'radix', name: '基数排序', en: 'LSD Radix Sort', category: '分配排序',
    summary: '本演示处理 0～999 的整数，固定按个位、十位、百位进行三趟稳定分配与收集。每个桶先进先出，让低位建立的次序在高位排序时保留下来。',
    code: [
      'void radixSort(vector<int>& a) {',
      '    if (a.empty()) return;',
      '    // 输入范围 0..999，固定处理个位、十位、百位。',
      '    for (int exp = 1; exp <= 100; exp *= 10) {',
      '        vector<vector<int>> buckets(10);',
      '        for (int value : a) {',
      '            int digit = (value / exp) % 10;',
      '            buckets[digit].push_back(value);',
      '        }',
      '        int k = 0;',
      '        for (int digit = 0; digit < 10; ++digit) {',
      '            for (int value : buckets[digit]) {',
      '                a[k++] = value;',
      '            }',
      '        }',
      '    }',
      '}'
    ],
    run(values) {
      const t = new root.Trace(values), n = t.a.length;
      if (values.some(v => !Number.isInteger(v) || v < 0 || v > 999)) throw new RangeError('基数排序演示仅接受 0～999 的整数。');
      t.emit([1, 2, 3], '用十个桶代替元素间大小比较', '这里限定 0～999，固定处理三位，无需寻找最大值。元素比较次数为 0；写入次数包括放入桶和写回主数组。', { vars: { n, radix: 10, digits: 3 }, buckets: Array.from({ length: 10 }, () => []) });
      if (!n) return t.done();
      const placeNames = { 1: '个位', 10: '十位', 100: '百位' };
      for (let exp = 1, pass = 1; exp <= 100; exp *= 10, ++pass) {
        const buckets = Array.from({ length: 10 }, () => []);
        t.emit([4, 5], `第 ${pass} 趟：按${placeNames[exp]}分配`, `exp = ${exp}，当前位 digit = (value / exp) % 10。每趟开始清空十个桶。`, { buckets, vars: { exp, pass, phase: '分配' } });
        for (let scan = 0; scan < n; ++scan) {
          const record = t.a[scan], digit = Math.floor(record.v / exp) % 10;
          buckets[digit].push(record);
          ++t.writes;
          t.emit([6, 7, 8], `${record.v} 的${placeNames[exp]}是 ${digit}，进入 ${digit} 号桶`, '从左向右扫描，元素排在桶尾。相同位数的元素在桶内保持进入时的顺序。', { buckets, active: [scan], pointers: { scan }, vars: { exp, pass, digit, value: record.v, phase: '分配' } });
        }
        let k = 0;
        t.emit([10, 11], '按 0 → 9 的桶序收集', '每个桶内部也必须从前往后取出，才能保持本趟稳定。分配和收集都不需要比较两个元素的大小。', { buckets, vars: { exp, pass, k, phase: '收集' } });
        for (let digit = 0; digit < 10; ++digit) {
          for (const record of buckets[digit]) {
            const dest = k++;
            t.a[dest] = record;
            ++t.writes;
            t.emit([11, 12, 13], `从 ${digit} 号桶取出 ${record.v}，写入 a[${dest}]`, '按进入顺序收集，保留之前各低位建立的顺序。桶中仍显示本轮内容，表示辅助存储副本。', { buckets, changed: [dest], pointers: { k: dest }, vars: { exp, pass, digit, k, phase: '收集' } });
          }
        }
        t.emit([16], `第 ${pass} 趟完成：已按低 ${pass} 位有序`, exp === 100 ? '三位全部处理完毕，对 0～999 的输入已经得到完整的升序结果。' : `当前只保证低 ${pass} 位有序，整个数值仍可能无序。下一趟按更高一位稳定地分配与收集。`, { buckets, sorted: exp === 100 ? indices(0, n - 1) : [], vars: { exp, pass, phase: '本趟结束' } });
      }
      return t.done();
    }
  };
})();
