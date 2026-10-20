(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const modules = root.SortModules || (root.SortModules = {});
  const indices = (from, to) => Array.from({ length: Math.max(0, to - from + 1) }, (_, k) => from + k);

  modules.insertion = {
    id: 'insertion',
    name: '直接插入排序',
    en: 'Insertion Sort',
    category: '插入排序',
    summary: '把当前元素暂存为 x，将它插入左侧有序区。只有严格大于 x 的元素才右移，因此相等元素的先后顺序不变。',
    code: [
      'void insertionSort(vector<int>& a) {',
      '    int n = (int)a.size();',
      '    for (int i = 1; i < n; ++i) {',
      '        int x = a[i];',
      '        int j = i - 1;',
      '        while (j >= 0 && a[j] > x) {',
      '            a[j + 1] = a[j];',
      '            --j;',
      '        }',
      '        a[j + 1] = x;',
      '    }',
      '}'
    ],
    run(values) {
      const t = new Trace(values);
      const n = t.a.length;
      t.emit([1, 2], '从一个元素的有序区开始', '左侧有序区逐步扩大。暂存的 x 会显示在辅助区；移动时数组中出现重复标签是正常的。', { ordered: n ? [0] : [], vars: { n } });
      for (let i = 1; i < n; ++i) {
        const x = t.a[i];
        let j = i - 1;
        t.emit([3, 4, 5], `取出 a[${i}] = ${x.v}`, `把 ${x.v} 暂存为 x，从有序区最右端开始寻找插入位置。`, {
          active: [i], ordered: indices(0, i - 1), pointers: { i, j }, vars: { i, j, x: x.v }, aux: [x]
        });
        while (j >= 0) {
          ++t.comparisons;
          const move = t.a[j].v > x.v;
          t.emit([6], `比较 ${t.a[j].v} 与 x = ${x.v}`, move ? `${t.a[j].v} > ${x.v}，需要右移，为 x 腾出位置。` : `${t.a[j].v} ≤ ${x.v}，停止左查。相等时不右移，保持稳定。`, {
            active: [j], pointers: { i, j }, vars: { i, j, x: x.v }, aux: [x]
          });
          if (!move) break;
          const source = j;
          t.a[j + 1] = t.a[j];
          ++t.writes;
          --j;
          t.emit([7, 8], `将 a[${source}] 右移一格`, `写入 a[${source + 1}]，继续检查左侧元素。x 仍保存在辅助区。`, {
            changed: [source + 1], pointers: { i, j }, vars: { i, j, x: x.v }, aux: [x]
          });
        }
        t.a[j + 1] = x;
        ++t.writes;
        t.emit([10], `将 x = ${x.v} 插入 a[${j + 1}]`, `现在 a[0..${i}] 有序。这个前缀后续仍可能被新元素挤动，不代表位置已最终确定。`, {
          changed: [j + 1], ordered: indices(0, i), pointers: { i, pos: j + 1 }, vars: { i, j, x: x.v }
        });
      }
      return t.done();
    }
  };

  modules.binary = {
    id: 'binary',
    name: '折半插入排序',
    en: 'Binary Insertion Sort',
    category: '插入排序',
    summary: '在有序前缀中折半查找插入位置，再整体右移。遇到相等元素向右查，插在已有相等元素之后；比较减少，移动次数仍可能为平方级。',
    code: [
      'void binaryInsertionSort(vector<int>& a) {',
      '    int n = (int)a.size();',
      '    for (int i = 1; i < n; ++i) {',
      '        int x = a[i];',
      '        int low = 0, high = i;',
      '        while (low < high) {',
      '            int mid = low + (high - low) / 2;',
      '            if (a[mid] <= x) low = mid + 1;',
      '            else high = mid;',
      '        }',
      '        for (int j = i; j > low; --j) {',
      '            a[j] = a[j - 1];',
      '        }',
      '        a[low] = x;',
      '    }',
      '}'
    ],
    run(values) {
      const t = new Trace(values);
      const n = t.a.length;
      t.emit([1, 2], '折半查位置，顺序移元素', '查找区间使用 [low, high)，high 不属于区间。数组下标从 0 开始。', { ordered: n ? [0] : [], vars: { n } });
      for (let i = 1; i < n; ++i) {
        const x = t.a[i];
        let low = 0;
        let high = i;
        t.emit([3, 4, 5], `暂存 a[${i}] = ${x.v}`, `在有序前缀 a[0..${i - 1}] 中寻找第一个大于 x 的位置。`, {
          active: [i], ordered: indices(0, i - 1), range: [low, high - 1], pointers: { i, low, high }, vars: { i, low, high, x: x.v }, aux: [x]
        });
        while (low < high) {
          const mid = low + Math.floor((high - low) / 2);
          ++t.comparisons;
          const goRight = t.a[mid].v <= x.v;
          t.emit([6, 7, 8], `检查中点 a[${mid}] = ${t.a[mid].v}`, goRight ? `${t.a[mid].v} ≤ ${x.v}，插入点在中点右侧；相等时也向右，保持稳定。` : `${t.a[mid].v} > ${x.v}，插入点在中点或它左侧。`, {
            active: [mid], ordered: indices(0, i - 1), range: [low, high - 1], pointers: { low, mid, high }, vars: { i, low, high, mid, x: x.v }, aux: [x]
          });
          if (goRight) low = mid + 1;
          else high = mid;
          const opts = { pointers: { low, high }, vars: { i, low, high, x: x.v }, aux: [x], ordered: indices(0, i - 1) };
          if (low < high) opts.range = [low, high - 1];
          t.emit(goRight ? [8] : [9], low === high ? `锁定插入位置 ${low}` : `缩小到 [${low}, ${high})`, low === high ? 'low == high，查找结束。现在将插入点右侧的元素逐一右移。' : '每次排除约一半候选位置。high 始终是开区间的右边界。', opts);
        }
        for (let j = i; j > low; --j) {
          t.a[j] = t.a[j - 1];
          ++t.writes;
          t.emit([11, 12], `将 a[${j - 1}] 移到 a[${j}]`, `从右向左搬移，避免覆盖尚未搬走的元素。插入位置保持为 ${low}。`, {
            changed: [j], pointers: { j, low }, vars: { i, j, low, x: x.v }, aux: [x]
          });
        }
        t.a[low] = x;
        ++t.writes;
        t.emit([14], `将 x = ${x.v} 放入 a[${low}]`, `a[0..${i}] 已有序。折半查找节省比较，但右移操作仍需逐个完成。`, {
          changed: [low], ordered: indices(0, i), pointers: { low, i }, vars: { i, low, x: x.v }
        });
      }
      return t.done();
    }
  };

  modules.shell = {
    id: 'shell',
    name: '希尔排序',
    en: 'Shell Sort',
    category: '插入排序',
    summary: '先按较大间隔 gap 做分组插入，再逐步缩小到 1。本演示使用 n/2、n/4、…、1 的增量序列；跨越移动可能改变相等元素的先后顺序。',
    code: [
      'void shellSort(vector<int>& a) {',
      '    int n = (int)a.size();',
      '    for (int gap = n / 2; gap > 0; gap /= 2) {',
      '        for (int i = gap; i < n; ++i) {',
      '            int x = a[i];',
      '            int j = i;',
      '            while (j >= gap && a[j - gap] > x) {',
      '                a[j] = a[j - gap];',
      '                j -= gap;',
      '            }',
      '            a[j] = x;',
      '        }',
      '    }',
      '}'
    ],
    run(values) {
      const t = new Trace(values);
      const n = t.a.length;
      t.emit([1, 2], '让元素先大步接近目标位置', '相同余数的下标构成一组，每组执行间隔为 gap 的直接插入排序。最后 gap = 1 时整理整个数组。', { vars: { n } });
      for (let gap = Math.floor(n / 2); gap > 0; gap = Math.floor(gap / 2)) {
        const groups = Array.from({ length: gap }, (_, r) => indices(0, Math.floor((n - 1 - r) / gap)).map(k => r + k * gap).join('→')).join('；');
        t.emit([3], `本趟增量 gap = ${gap}`, `本趟各组下标：${groups}。只在同组中比较、移动。`, { vars: { gap } });
        for (let i = gap; i < n; ++i) {
          const x = t.a[i];
          let j = i;
          t.emit([4, 5, 6], `在第 ${i % gap} 组插入 ${x.v}`, `暂存 a[${i}]，从下标 ${i - gap} 开始，每次向左跨 ${gap} 格。`, {
            active: [i], pointers: { i, j }, vars: { gap, i, j, x: x.v }, aux: [x]
          });
          while (j >= gap) {
            const source = j - gap;
            ++t.comparisons;
            const move = t.a[source].v > x.v;
            t.emit([7], `比较同组元素 ${t.a[source].v} 与 ${x.v}`, move ? `${t.a[source].v} > ${x.v}，向右移动 ${gap} 格。` : `${t.a[source].v} ≤ ${x.v}，已找到 x 在本组中的插入位置。`, {
              active: [source], pointers: { source, j }, vars: { gap, i, j, x: x.v }, aux: [x]
            });
            if (!move) break;
            const target = j;
            t.a[j] = t.a[source];
            ++t.writes;
            j -= gap;
            t.emit([8, 9], `从下标 ${source} 移到 ${target}`, `空位向左跨 ${gap} 格。此时暂存的 x 仍在辅助区。`, {
              changed: [target], pointers: { j }, vars: { gap, i, j, x: x.v }, aux: [x]
            });
          }
          t.a[j] = x;
          ++t.writes;
          t.emit([11], `把 ${x.v} 插入下标 ${j}`, gap === 1 ? `gap = 1，a[0..${i}] 形成有序前缀。` : `当前组在已处理范围内有序；不同组之间还没有整体排好。`, {
            changed: [j], ordered: gap === 1 ? indices(0, i) : [], pointers: { i, j }, vars: { gap, i, j, x: x.v }
          });
        }
        t.emit([3, 12, 13], `gap = ${gap} 的一趟完成`, gap === 1 ? '增量已经是 1，整个数组有序。' : '各组分别有序。将 gap 整除 2，使用更小的间隔继续整理。', {
          ordered: gap === 1 ? indices(0, n - 1) : [], vars: { gap, nextGap: Math.floor(gap / 2) }
        });
      }
      return t.done();
    }
  };

  modules.bubble = {
    id: 'bubble',
    name: '冒泡排序',
    en: 'Bubble Sort',
    category: '交换排序',
    summary: '逐对比较相邻元素，把较大者不断交换到右侧。每趟固定一个最大值；一趟没有交换就提前结束。相等元素不交换，因此稳定。',
    code: [
      'void bubbleSort(vector<int>& a) {',
      '    int n = (int)a.size();',
      '    for (int end = n - 1; end > 0; --end) {',
      '        bool swapped = false;',
      '        for (int j = 0; j < end; ++j) {',
      '            if (a[j] > a[j + 1]) {',
      '                swap(a[j], a[j + 1]);',
      '                swapped = true;',
      '            }',
      '        }',
      '        if (!swapped) break;',
      '    }',
      '}'
    ],
    run(values) {
      const t = new Trace(values);
      const n = t.a.length;
      t.emit([1, 2], '相邻比较，让最大值逐步右移', '每趟扫描后，未排序区的最大值会到达最右端；绿色位置表示已经最终确定。', { vars: { n } });
      for (let end = n - 1; end > 0; --end) {
        let swapped = false;
        t.emit([3, 4], `扫描未排序区 a[0..${end}]`, '先把 swapped 设为 false，记录这一趟是否发生交换。', {
          range: [0, end], sorted: indices(end + 1, n - 1), pointers: { end }, vars: { end, swapped }
        });
        for (let j = 0; j < end; ++j) {
          ++t.comparisons;
          const exchange = t.a[j].v > t.a[j + 1].v;
          t.emit([5, 6], `比较相邻的 ${t.a[j].v} 与 ${t.a[j + 1].v}`, exchange ? '左边更大，交换这两个元素，让较大者向右走。' : '相邻次序正确，继续向右。相等时也不交换。', {
            active: [j, j + 1], sorted: indices(end + 1, n - 1), range: [0, end], pointers: { j, end }, vars: { end, j, swapped }
          });
          if (exchange) {
            t.swap(j, j + 1);
            swapped = true;
            t.emit([7, 8], `交换 a[${j}] 和 a[${j + 1}]`, 'swapped 变为 true。较大元素继续参加下一次相邻比较。', {
              changed: [j, j + 1], sorted: indices(end + 1, n - 1), range: [0, end], pointers: { j, end }, vars: { end, j, swapped }
            });
          }
        }
        t.emit([10, 11], swapped ? `下标 ${end} 的位置已固定` : '本趟没有交换，提前结束', swapped ? `未排序区的最大值已到达 a[${end}]。下一趟右边界左移一格。` : '这一趟所有相邻元素都满足非降序，整个数组已经有序，无需继续扫描。', {
          sorted: swapped ? indices(end, n - 1) : indices(0, n - 1), pointers: { end }, vars: { end, swapped }
        });
        if (!swapped) break;
      }
      return t.done();
    }
  };
}());
