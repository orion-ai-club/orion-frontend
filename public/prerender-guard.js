(() => {
  const root = document.getElementById('root');
  if (!root) return;

  const renderedPath = root.getAttribute('data-prerender-path');
  if (!renderedPath) return;

  const normalize = (value) => {
    if (!value || value === '/') return '/';
    return value.replace(/\/+$/, '') || '/';
  };

  if (normalize(renderedPath) !== normalize(window.location.pathname)) {
    root.replaceChildren();
  }
})();
