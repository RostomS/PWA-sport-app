/* e2e-behaviour.js — contrôles de comportement v18 (sauvegarde au récap, charge vide, échauffement, RIR, chemin unique, tendance du poids, record en direct).
   Usage : python3 -m http.server 8765 &   puis   node tools/e2e-behaviour.js <dossier-captures> */
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch(); let pass = 0, fail = 0; const errors = [];
  const ok = (c, n) => { if (c) pass++; else { fail++; console.log('FAIL', n); } };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, colorScheme: 'dark', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('pageerror', e => errors.push(e.message));
  const tap = async (sel) => { await page.locator(sel).first().click(); await page.waitForTimeout(450); };
  const W = (s) => `input[data-b="0"][data-s="${s}"][data-f="weight"]`, C = (s) => `.set-check[data-b="0"][data-s="${s}"]`;
  await page.goto('http://localhost:8765/index.html'); await page.waitForSelector('#onboard');
  // onboarding complet avec objectif "masse" + poids 78
  await tap('[data-action="onb-next"]'); await tap('[data-action="onb-goal"][data-v="masse"]'); await tap('[data-action="onb-next"]');
  await tap('[data-action="onb-exp"]'); await tap('[data-action="onb-next"]'); await tap('[data-action="onb-next"]');
  await page.fill('[data-action="onb-weight"]', '78'); await page.locator('[data-action="onb-weight"]').blur(); await tap('[data-action="onb-next"]'); await tap('[data-action="onb-finish"]');
  const name1 = (await page.textContent('.hero .session-name')).trim();
  await tap('[data-action="start-picker"]'); await tap('[data-action="start"]');
  ok((await page.inputValue('input[data-b="0"][data-s="0"][data-f="rir"]')) === '', '4 rir vide par défaut');
  await tap(C(0)); ok(!(await page.$('#timer')) && (await page.$$('.set-check.on')).length === 0, '2 charge vide sans référence → refus');
  await page.fill(W(0), '60'); await page.locator(W(0)).blur(); await tap(C(0));
  ok(await page.$('#timer'), 'timer'); ok(!(await page.$('.timer-pr')), '7 pas de PR sans historique'); await tap('[data-action="timer-skip"]');
  await tap('[data-action="finish"]'); await tap('[data-action="recap-continue"]');
  ok(await page.$('#ck-done'), 'check-in ouvert'); await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  ok(await page.$('.hero'), '1 retour accueil après fermeture du check-in');
  const n = await page.evaluate(() => new Promise(r => { const q = indexedDB.open('chrono-musculation'); q.onsuccess = () => { const c = q.result.transaction('sessions').objectStore('sessions').count(); c.onsuccess = () => r(c.result); }; }));
  ok(n === 1, '1 séance enregistrée sans check-in (' + n + ')');
  // 5) chemin unique : changer → aperçu → mettre à aujourd'hui
  await tap('[data-action="reorder"]'); ok(!(await page.$('[data-action="bump"]')), '5 plus de bouton bump');
  await page.locator('#sheet .lib-item', { hasText: name1 }).first().click(); await page.waitForTimeout(450);
  await tap('[data-action="do-session"]');
  ok((await page.textContent('.hero .session-name')).trim() === name1, '5 séance remise à aujourd’hui');
  await tap('[data-action="start-picker"]'); await tap('[data-action="start"]');
  await page.fill(W(0), ''); await page.locator(W(0)).blur(); await tap(C(0));
  ok((await page.inputValue(W(0))) === '60' && await page.$('#timer'), '2 charge vide → reprend la dernière (60)');
  ok(!(await page.$('.timer-pr')), '7 pas de PR à charge égale'); await tap('[data-action="timer-skip"]');
  await page.fill(W(1), '65'); await page.locator(W(1)).blur(); await tap(C(1));
  ok(await page.$('.timer-pr'), '7 PR annoncé en direct'); await page.waitForTimeout(900); await page.screenshot({ path: process.argv[2] + '/pr-live.png' });
  await tap('[data-action="timer-skip"]');
  await tap('.sidx[data-b="0"][data-s="2"]'); ok(await page.$('.sidx[data-b="0"][data-s="2"].type-warm'), 'type warm');
  await page.fill(W(2), '20'); await page.locator(W(2)).blur(); await tap(C(2));
  ok(!(await page.$('#timer')) && await page.$(C(2) + '.on'), '3 échauffement validé sans chrono');
  await tap('[data-action="finish"]'); await tap('[data-action="recap-continue"]'); await tap('[data-ck="energy"]'); await tap('[data-ck="sleep"]'); await tap('#ck-done');
  const ck = await page.evaluate(() => new Promise(r => { const q = indexedDB.open('chrono-musculation'); q.onsuccess = () => { const c = q.result.transaction('sessions').objectStore('sessions').getAll(); c.onsuccess = () => r(c.result.map(s => !!s.checkin)); }; }));
  ok(ck.length === 2 && !ck[0] && ck[1], '1 check-in ajouté à la séance déjà enregistrée ' + JSON.stringify(ck));
  // 6) tendance du poids : objectif masse, +1 kg → 'up'
  await tap('#tabbar [data-nav="progress"]'); await tap('[data-action="body-add"]');
  const wsel = await page.evaluate(() => { const i = document.querySelector('#sheet input'); return i ? i.id : null; });
  await page.fill('#sheet input', '79'); await tap('[data-action="body-save"]');
  ok(await page.$('.big-num + .delta.up'), '6 hausse = progrès en prise de masse (' + wsel + ')');
  console.log(`pass ${pass} fail ${fail}`, 'errors', errors.length, errors.slice(0, 5));
  await browser.close();
})();
