/* app.js — Bootstrap : enregistre le service worker, charge l'état, lance l'UI. */
(async function () {
  // Service worker (offline). Chemin relatif pour fonctionner quel que soit le sous-dossier d'hébergement.
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('sw.js'); } catch (e) { /* offline non bloquant */ }
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
