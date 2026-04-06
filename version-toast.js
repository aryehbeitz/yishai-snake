/* Version toast — include in all pages */
(function() {
  const STORAGE_KEY = 'lastSeenDeploy';
  const CHECK_INTERVAL = 15000; // 15s

  function check() {
    // Fetch deploy timestamp to detect changes
    fetch('version.txt?_=' + Date.now()).then(r => r.text()).then(deploy => {
      deploy = deploy.trim();
      if (!deploy) return;
      const lastDeploy = localStorage.getItem(STORAGE_KEY);
      if (lastDeploy && lastDeploy !== deploy) {
        // New deploy detected — get the semantic version from changelog
        fetch('changelog.json?_=' + Date.now()).then(r => r.json()).then(data => {
          const latest = data[0];
          showToast(latest ? latest.version : '1.0.0');
        }).catch(() => showToast('1.0.0'));
      }
      localStorage.setItem(STORAGE_KEY, deploy);
    }).catch(() => {});
  }

  function showToast(version) {
    if (document.getElementById('version-toast')) return;
    const toast = document.createElement('div');
    toast.id = 'version-toast';
    toast.innerHTML = `
      <span>🆕 גרסה חדשה: <b>v${version}</b></span>
      <button onclick="location.reload()" title="רענון">⟳</button>
      <a href="changelog.html">מה חדש?</a>
      <button onclick="this.parentElement.remove()">✕</button>
    `;
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '1rem',
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#16213e',
      border: '1px solid #39ff1466',
      borderRadius: '12px',
      padding: '.6rem 1rem',
      display: 'flex',
      alignItems: 'center',
      gap: '.75rem',
      zIndex: '9999',
      boxShadow: '0 4px 20px #00000066',
      fontSize: '.85rem',
      color: '#e0e0e0',
      maxWidth: 'calc(100vw - 2rem)',
      animation: 'toastIn .4s ease',
    });
    toast.querySelector('a').style.cssText = 'color:#39ff14;text-decoration:none;font-weight:700;white-space:nowrap;';
    const refreshBtn = toast.querySelectorAll('button')[0];
    refreshBtn.style.cssText = 'background:none;border:none;color:#39ff14;font-size:1.2rem;cursor:pointer;padding:0;';
    toast.querySelector('button:last-child').style.cssText = 'background:none;border:none;color:#888;font-size:1.1rem;cursor:pointer;padding:0 0 0 .25rem;';

    if (!document.getElementById('toast-style')) {
      const style = document.createElement('style');
      style.id = 'toast-style';
      style.textContent = '@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
      document.head.appendChild(style);
    }

    document.body.appendChild(toast);
    setTimeout(() => { if (toast.parentElement) toast.remove(); }, 15000);
  }

  setTimeout(check, 2000);
  setInterval(check, CHECK_INTERVAL);
})();
