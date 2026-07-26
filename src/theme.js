(function() {
  let theme = 'system';
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key === 'prefs_anonymous' || key.startsWith('prefs_')) {
        const val = JSON.parse(localStorage.getItem(key));
        if (val && val.theme) {
          theme = val.theme;
          break;
        }
      }
    }
  } catch (e) {}
  let activeTheme = theme;
  if (theme === 'system') {
    activeTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', activeTheme);
})();
