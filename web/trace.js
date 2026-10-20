(function () {
  class Trace {
    constructor(values) {
      this.a = values.map((v, id) => ({v, id}));
      this.frames = [];
      this.comparisons = 0; this.writes = 0; this.swaps = 0;
    }
    swap(i, j) {
      [this.a[i], this.a[j]] = [this.a[j], this.a[i]];
      this.swaps++; this.writes += 2;
    }
    emit(lines, title, note, opts = {}) {
      this.frames.push(JSON.parse(JSON.stringify({
        arr: this.a, lines: Array.isArray(lines) ? lines : [lines], title, note,
        active: [], changed: [], sorted: [], ordered: [], pointers: {}, vars: {},
        ...opts,
        stats: {comparisons: this.comparisons, writes: this.writes, swaps: this.swaps}
      })));
    }
    done() {
      this.emit([], '排序完成', '数组已按非递减顺序排列。', {sorted: this.a.map((_, i) => i), phase: '完成'});
      return this.frames;
    }
  }
  window.Trace = Trace;
  window.SortModules = window.SortModules || {};
})();
