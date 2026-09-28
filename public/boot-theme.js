(() => {
  try {
    const savedTheme = localStorage.getItem('app_theme') || 'light';
    document.documentElement.dataset.appTheme = savedTheme;

    if (savedTheme === 'dark' && !location.pathname.startsWith('/captain-cabin')) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch {
    // Theme boot should never block application startup.
  }
})();
