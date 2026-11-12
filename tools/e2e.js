/* e2e.js — parcours de non-régression (Playwright, mobile 390×844 ; clair, sombre, mouvement réduit).
   Usage : python3 -m http.server 8765 &   puis   node tools/e2e.js <dossier-captures>
   Playwright n'est pas une dépendance du dépôt : l'installer hors dépôt ou le retirer avant commit. */
const { chromium } = require('playwright');
const out = process.argv[2];
(async () => {
  const browser = await chromium.launch();
  const errors = []; let pass = 0, fail = 0;
  const ok = (c, n) => { if (c) pass++; else { fail++; console.log('FAIL', n); } };
  async function run(scheme, reduced) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, colorScheme: scheme, reducedMotion: reduced ? 'reduce' : 'no-preference', serviceWorkers: 'block' });
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') errors.push(scheme + ': ' + m.text()); });
    page.on('pageerror', e => errors.push(scheme + ' pageerror: ' + e.message));
    const shot = (n) => page.screenshot({ path: `${out}/${scheme}${reduced ? '-rm' : ''}-${n}.png` });
    const tap = async (sel) => { await page.locator(sel).first().click(); await page.waitForTimeout(reduced ? 80 : 420); };
    await page.goto('http://localhost:8765/index.html'); await page.waitForSelector('#onboard');
    await page.waitForTimeout(500); await shot('onb0');
    await tap('[data-action="onb-next"]'); await tap('[data-action="onb-goal"]'); await shot('onb1');
    await tap('[data-action="onb-next"]'); await tap('[data-action="onb-exp"]'); await tap('[data-action="onb-next"]');
    await tap('[data-action="onb-next"]'); await tap('[data-action="onb-next"]');
    await tap('[data-action="onb-day"]'); await shot('onb5'); await tap('[data-action="onb-finish"]');
    ok(!(await page.$('#onboard')), 'onboarding closed');
    await page.waitForTimeout(500); await shot('home');
    await tap('.upnext .mini'); ok(await page.$('#sheet'), 'preview sheet'); await shot('sheet-preview');
    await page.keyboard.press('Escape'); await page.waitForTimeout(350); ok(!(await page.$('#sheet')), 'esc closes'); ok((await page.$$('.sheet-backdrop')).length === 0, 'sheet removed');
    await tap('[data-action="reorder"]'); await tap('.sheet-close'); ok(!(await page.$('#sheet')), 'x closes');
    await tap('[data-action="start-picker"]'); await shot('sheet-start'); await tap('[data-action="start"]');
    ok(await page.$('.ex-card'), 'session view'); await page.waitForTimeout(400); await shot('session');
    await page.locator('input[data-f="weight"]').first().fill('60');
    await page.locator('input[data-f="reps"]').first().fill('8'); await page.locator('input[data-f="reps"]').first().blur();
    await page.locator('[data-action="toggle-set"]').first().click(); await page.waitForTimeout(700);
    ok(await page.$('#timer'), 'timer opens'); await shot('timer');
    const t1 = await page.textContent('#t-read'); await tap('[data-action="timer-add"]'); const t2 = await page.textContent('#t-read');
    ok(t1 !== t2, 'timer +30 ' + t1 + ' ' + t2);
    await tap('[data-action="timer-skip"]'); ok(!(await page.$('#timer')), 'timer skipped'); await page.waitForTimeout(300);
    ok((await page.$$('.timer-sheet')).length === 0, 'timer removed');
    ok((await page.$$('.set-check.on')).length === 1, 'set logged'); await shot('session-logged');
    await tap('[data-action="cycle-type"]'); if (await page.$('[data-action="plates"]')) { await tap('[data-action="plates"]'); await shot('sheet-plates'); await tap('.sheet-close'); }
    await tap('[data-action="substitute"]'); await shot('sheet-sub'); await tap('.sheet-close');
    await tap('[data-action="finish"]'); ok(await page.$('.recap-kpis'), 'recap'); await page.waitForTimeout(1900); await shot('recap');
    await tap('[data-action="recap-continue"]'); await shot('checkin'); await tap('#ck-skip');
    await page.waitForTimeout(400); ok(await page.$('.hero'), 'back home'); await shot('home-after');
    for (const r of ['train', 'volume', 'progress', 'more']) { await tap(`#tabbar [data-nav="${r}"]`); ok((await page.getAttribute(`#tabbar [data-nav="${r}"]`, 'aria-current')) === 'page', 'tab ' + r); await page.waitForTimeout(350); await shot(r); }
    await tap('[data-action="theme"][data-v="dark"]'); ok((await page.getAttribute('html', 'data-theme')) === 'dark', 'theme dark'); await shot('more-forced-dark');
    await tap('[data-action="theme"][data-v="auto"]');
    await tap('#tabbar [data-nav="train"]'); await tap('[data-tab="seances"]'); await shot('train-seances'); await tap('[data-tab="exos"]'); await shot('train-exos');
    await tap('[data-action="edit-exercise"]'); await shot('sheet-exform'); await tap('.sheet-close');
    await tap('[data-tab="prog"]'); await tap('[data-action="prog-detail"]'); await shot('sheet-prog'); await tap('.sheet-close');
    await tap('[data-nav="program"]'); await shot('program'); 
    await tap('#tabbar [data-nav="progress"]'); await tap('[data-action="one-rm"]'); await page.fill('#orm-w', '100'); await page.fill('#orm-r', '5'); await shot('sheet-orm'); await tap('.sheet-close');
    await tap('[data-action="session-detail"]'); await shot('sheet-detail'); await tap('.sheet-close');
    await page.evaluate(() => window.scrollTo(0, 99999)); await page.waitForTimeout(200); await shot('progress-bottom');
    const hs = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); ok(!hs, 'no horizontal scroll');
    await ctx.close();
  }
  await run('light', false); await run('dark', false); await run('dark', true);
  console.log(`pass ${pass} fail ${fail}`); console.log('console errors:', errors.length, errors.slice(0, 8));
  await browser.close();
})();
