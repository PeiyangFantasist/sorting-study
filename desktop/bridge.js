(() => {
  if (location.origin !== 'https://sorting-study.test') return;
  let next = 0;
  const pending = new Map();
  window.chrome.webview.addEventListener('message', event => {
    const message = event.data;
    if (message?.type !== 'save-result') return;
    const resolve = pending.get(message.id);
    if (resolve) { pending.delete(message.id); resolve(Boolean(message.ok)); }
  });
  window.SortDesktop = {
    saveCpp(code, filename) {
      return new Promise(resolve => {
        const id = ++next;
        pending.set(id, resolve);
        window.chrome.webview.postMessage(JSON.stringify({type:'save-cpp',id,code,filename}));
      });
    }
  };
  document.addEventListener('keydown', event => {
    if (event.key === 'F11') { event.preventDefault(); window.chrome.webview.postMessage('fullscreen'); }
  });
})();
