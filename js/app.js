/* app.js — Bootstrap : enregistre le service worker, charge l'état, lance l'UI. */
window.APP_VERSION = '13';
(async function () {
  // Service worker (offline) + mise à jour automatique transparente.
  if ('serviceWorker' in navigator) {
    try {
      // La page est-elle déjà contrôlée ? (vrai à la réouverture d'une app installée)
      const hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Un nouveau service worker vient de prendre le contrôle → recharge une fois pour
        // afficher la nouvelle version. On ignore la toute première prise de contrôle (install initiale).
        if (!hadController || window.__reloading) return;
        window.__reloading = true; location.reload();
      });
      const reg = await navigator.serviceWorker.register('sw.js');
      reg.update().catch(() => {});
    } catch (e) { /* offline non bloquant */ }
  }
  try {
    await Store.load();
    UI.init();
  } catch (err) {
    console.error(err);
    document.getElementById('boot').innerHTML =
      '<div style="text-align:center;padding:24px"><p>Impossible de démarrer le stockage local.</p><p style="opacity:.7;font-size:13px">' + (err && err.message ? err.message : err) + '</p><button onclick="location.reload()" style="margin-top:12px;padding:10px 16px;border-radius:12px;border:0;background:#3D5AFE;color:#fff;font-weight:700">Réessayer</button></div>';
  }
})();
