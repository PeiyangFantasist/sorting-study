(() => {
  if (location.origin !== 'https://appassets.androidplatform.net') return;
  const native = window.SortingAndroidNative;
  if (!native) return;
  let next = 0;
  const pending = new Map();
  const request = (method, ...args) => new Promise((resolve, reject) => {
    const id = ++next;
    pending.set(id, {resolve, reject, method});
    try { native[method](id, ...args); }
    catch (error) { pending.delete(id); reject(error); }
  });
  window.SortAndroidResolve = (id, ok) => {
    const task = pending.get(id);
    if (!task) return;
    pending.delete(id);
    if (task.method === 'copyText' && !ok) task.reject(new Error('复制失败'));
    else task.resolve(Boolean(ok));
  };
  window.SortDesktop = {saveCpp: (code, filename) => request('saveCpp', filename, code)};
  try {
    Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{writeText:text=>request('copyText', String(text))}});
  } catch (_) { }
  document.addEventListener('DOMContentLoaded', () => {
    const footer = document.querySelector('footer span:last-child');
    if (footer) footer.textContent = '8 种算法 · C++17 · 安卓离线版';
    const progress = document.querySelector('.sidebar-bottom p');
    if (progress) progress.textContent = '进度保存在本机';
  });
})();
