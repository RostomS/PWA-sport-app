/* ui.js — Rendu et interactions de toutes les vues. Voix FR à la première personne
   utilisateur, active, cohérente (cf. brief copy). Aucun rendu de logique métier ici :
   on consomme Logic + Store. */
(function () {
  const S = () => Store.State;
  const app = () => document.getElementById('app');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let route = 'home';
  let timer = null; // { total, remaining, interval, exId }

  // ---- icônes tabbar (inline, offline) ----
  const IC = {
    home: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>',
    volume: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 20V9M12 20V4M19 20v-7"/></svg>',
    train: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>',
    progress: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5-5 4 4 8-8"/><path d="M21 8v4M21 8h-4"/></svg>',
    more: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
  };
  const TABS = [['home', 'Aujourd’hui', IC.home], ['train', 'Programme', IC.train], ['volume', 'Volume', IC.volume], ['progress', 'Progrès', IC.progress], ['more', 'Réglages', IC.more]];

  // La barre n'est construite qu'une fois : on ne fait ensuite que déplacer l'état actif,
  // ce qui laisse les transitions CSS (index glissant, icône) jouer.
  const tabOf = (r) => r === 'session' ? 'home' : r === 'program' ? 'train' : r;
  function renderTabs() {
    const tb = document.getElementById('tabbar'); tb.hidden = false;
    if (!tb.firstElementChild) tb.innerHTML = TABS.map(([r, label, ic]) => `<button data-nav="${r}"><span class="ic">${ic}</span>${label}</button>`).join('');
    const idx = TABS.findIndex(t => t[0] === tabOf(route));
    tb.querySelectorAll('button').forEach((b, i) => { if (i === idx) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    tb.style.setProperty('--tab-i', Math.max(0, idx)); tb.style.setProperty('--tab-on', idx < 0 ? 0 : 1);
  }

  // Navigation réelle : l'entrée de vue (direction + cascade) ne joue QUE ici,
  // jamais sur un simple re-render d'état.
  const ROUTE_ORDER = ['home', 'train', 'program', 'volume', 'progress', 'more'];
  let enterDir = 0;
  function go(r) {
    const a = ROUTE_ORDER.indexOf(route), b = ROUTE_ORDER.indexOf(r);
    enterDir = (a < 0 || b < 0 || a === b) ? 0 : Math.sign(b - a);
    route = r; render(true); window.scrollTo(0, 0);
    if (r === 'session' && S().draft) requestWake(); else if (!timer) releaseWake();
  }

  // Graduations d'un cadran (60 traits, 12 majeurs) — motif signature.
  function dialTicks(c, rOut, rMaj, rMin) {
    let o = '';
    for (let i = 0; i < 60; i++) {
      const a = i / 60 * 2 * Math.PI, maj = i % 5 === 0, r = maj ? rMaj : rMin, sx = Math.sin(a), cx = Math.cos(a);
      o += `<line class="tk${maj ? ' maj' : ''}" x1="${(c + rOut * sx).toFixed(1)}" y1="${(c - rOut * cx).toFixed(1)}" x2="${(c + r * sx).toFixed(1)}" y2="${(c - r * cx).toFixed(1)}"/>`;
    }
    return o;
  }

  // Indicateur glissant des segments : repart de la position précédente après un re-render.
  const segLast = {};
  function syncSegs() {
    document.querySelectorAll('.seg2[data-seg]').forEach(el => {
      const k = el.dataset.seg, cur = +el.dataset.i;
      if (segLast[k] != null && segLast[k] !== cur) { el.style.setProperty('--i', segLast[k]); void el.offsetWidth; }
      el.style.setProperty('--i', cur); segLast[k] = cur;
    });
  }
  // Jauge de séance : la barre repart de sa valeur précédente ; l'horloge écoulée bat chaque seconde.
  const fmtElapsed = (iso) => { const t = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000)); const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), sec = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(sec).padStart(2, '0'); };
  let gaugeLast = null;
  function syncGauge() {
    const f = document.getElementById('sess-fill'); if (!f) { gaugeLast = null; return; }
    const cur = +f.dataset.frac;
    if (gaugeLast != null && gaugeLast !== cur) { f.style.transform = `scaleX(${gaugeLast})`; void f.offsetWidth; }
    f.style.transform = `scaleX(${cur})`; gaugeLast = cur;
  }
  setInterval(() => { const el = document.getElementById('elapsed'); if (el) el.textContent = fmtElapsed(el.dataset.start); }, 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && route === 'session' && S().draft) { wakeLock = null; requestWake(); } });
  const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // =====================================================================
  //  RENDER dispatch
  // =====================================================================
  function render(enter, soft) {
    const v = { home: viewHome, session: viewSession, volume: viewVolume, train: viewTrain, progress: viewProgress, more: viewMore, program: viewProgram }[route] || viewHome;
    app().innerHTML = `<div class="view${enter === true ? ' enter' : ''}${soft ? ' soft' : ''}" data-dir="${enter === true ? enterDir : 0}">${topbar()}${v()}</div>`;
    renderTabs(); syncSegs(); syncGauge();
  }
  const topbar = () => `<div class="topbar"><div class="brand"><span class="mark"></span>Chronographe</div><span class="date">${new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' }).replace(/\./g, '')}</span></div>`;

  // =====================================================================
  //  1) ACCUEIL — "Aujourd'hui" : une thèse, une réponse directe
  // =====================================================================
  function viewHome() {
    const draft = S().draft;
    const t = Store.todayTemplate();
    const blocks = Logic.activeBlocks(t);
    const est = Logic.estimateMinutes(blocks);
    const cardio = S().settings.cardioDefault.duration;
    const dl = Logic.deloadStatus();
    const fatigue4 = Logic.fatigueSuggests4Day();

    const status = [];
    status.push(`<span class="chip">${S().settings.mode} jours</span>`);
    if (dl.active) status.push('<span class="chip warn">Deload en cours</span>');
    else if (dl.due) status.push('<span class="chip warn">Deload conseillé</span>');
    const lastCk = S().sessions.filter(s => s.checkin).slice(-1)[0];
    if (lastCk && (lastCk.checkin.energy === 1 || lastCk.checkin.sleep === 1)) status.push('<span class="chip warn">Fatigue élevée</span>');
    else status.push('<span class="chip ok">Prêt</span>');

    const up = Store.upcoming(4).slice(1);
    const cta = draft
      ? `<button class="btn primary block cta" data-nav="session">Reprendre ${esc(draft.name)}</button>`
      : `<button class="btn primary block cta" data-action="start-picker">Démarrer ${esc(t.name)}</button>`;

    return `
    ${banners(dl, fatigue4)}
    <section class="hero">
      <svg class="hero-dial" viewBox="0 0 200 200" aria-hidden="true">${dialTicks(100, 97, 80, 89)}<line class="hand" x1="100" y1="114" x2="100" y2="12" style="animation-delay:-${new Date().getSeconds()}s"/><circle class="cap" cx="100" cy="100" r="4.5"/></svg>
      <div class="eyebrow">Aujourd’hui · ${esc(t.code || '')}</div>
      <div class="session-name">${esc(t.name)}</div>
      <div class="focus">${esc(t.focus)}</div>
      <div class="readout">
        <span><b>~${est}</b> min séance</span>
        <span><b>+${cardio}</b> min cardio</span>
        <span><b>${blocks.length}</b> exos</span>
      </div>
      <div class="status">${status.join('')}</div>
      ${weekRow()}
      ${cta}
    </section>

    <div class="between mt22 mb8"><div class="eyebrow">À suivre</div>
      <button class="btn ghost sm" data-action="reorder">Changer de séance</button></div>
    <div class="upnext">
      ${up.map(x => `<div class="mini" data-action="preview-session" data-id="${esc(x.id)}"><div class="k">${esc(x.code)}</div><div class="n">${esc(x.name)}</div><div class="muted num" style="font-size:11px;margin-top:4px">~${Logic.estimateMinutes(Logic.activeBlocks(x))} min</div></div>`).join('')}
    </div>

    <div class="card pad mt22">
      <div class="between"><div class="eyebrow">Régularité · 4 semaines</div>
        <button class="btn ghost sm" data-nav="progress">Détail</button></div>
      ${miniRegularity()}
    </div>`;
  }

  // Progression de la semaine en cours (lundi → dimanche) face à l'objectif du programme.
  function weekRow() {
    const mon = new Date(); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    const n = S().sessions.filter(x => new Date(x.date) >= mon).length;
    const target = Math.min(7, Math.max(1, +S().settings.mode || 6));
    return `<div class="week"><span>Semaine</span><span class="segs">${Array.from({ length: target }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span><b>${n}/${target}</b></div>`;
  }

  function banners(dl, fatigue4) {
    let out = '';
    if (dl.due) out += `<div class="banner amber mb12"><div><div class="ttl">5 semaines depuis le dernier deload</div><div class="body">Une semaine allégée (mêmes charges, −40% de séries) protège ta progression.</div><div class="acts"><button class="btn steel sm" data-action="apply-deload">Alléger cette semaine</button><button class="btn ghost sm" data-action="dismiss-deload">Plus tard</button></div></div></div>`;
    if (dl.active) out += `<div class="banner info mb12"><div><div class="ttl">Semaine de deload active</div><div class="body">Volume réduit de 40%. Reste sur tes charges, laisse le corps récupérer.</div></div></div>`;
    if (fatigue4) out += `<div class="banner amber mb12"><div><div class="ttl">Deux check-ins fatigués d’affilée</div><div class="body">Tu peux passer en mode 4 jours (Upper/Lower) le temps de récupérer. Rien n’est perdu, tu reviendras au 6 jours quand tu veux.</div><div class="acts"><button class="btn steel sm" data-action="to-4day">Passer en 4 jours</button><button class="btn ghost sm" data-action="dismiss-fatigue">Rester en 6 jours</button></div></div></div>`;
    return out;
  }

  function miniRegularity() {
    const days = Logic.regularityDays(4);
    const today = new Date().toDateString();
    return `<div class="cal mt10">${days.map(d => `<div class="d ${d.done ? 'done' : ''} ${d.date.toDateString() === today ? 'today' : ''}"></div>`).join('')}</div>`;
  }

  // =====================================================================
  //  2) SÉANCE ACTIVE — déroulé ordonné + log + timer + progression
  // =====================================================================
  function viewSession() {
    const d = S().draft;
    if (!d) return `<div class="empty"><div class="big">Aucune séance en cours</div><button class="btn primary" data-nav="home">Retour à l’accueil</button></div>`;
    const cards = d.blocks.map((b, i) => sessionCard(b, i, d.blocks.length)).join('');
    const doneCount = d.blocks.filter(b => b.sets.some(s => s.done)).length;
    const setsTotal = d.blocks.reduce((a, b) => a + b.sets.length, 0), setsDone = d.blocks.reduce((a, b) => a + b.sets.filter(s => s.done).length, 0);
    return `
      <div class="between mb14 session-head">
        <div><div class="eyebrow">Séance en cours</div><h1>${esc(d.name)}</h1></div>
        <button class="btn ghost sm" data-action="abort">Quitter</button>
      </div>
      <div class="sess-gauge">
        <span class="num el" id="elapsed" data-start="${esc(d.startedAt)}">${fmtElapsed(d.startedAt)}</span>
        <span class="bar"><i id="sess-fill" data-frac="${setsTotal ? (setsDone / setsTotal).toFixed(4) : 0}"></i></span>
        <span class="num cnt">${setsDone}/${setsTotal} séries</span>
      </div>
      ${d.note ? `<details class="why"><summary>Pourquoi cet ordre ?</summary><p>${esc(d.note)}</p><p class="why-rule">Règle générale : le compound le plus lourd en premier (tu es frais → plus de charge et plus de sécurité). L’ordre pèse surtout sur la force ; pour le muscle, c’est le volume près de l’échec qui compte — alors donne tout sur chaque série.</p></details>` : ''}
      ${d.dropped && d.dropped.length ? `<div class="banner info mb14"><div><div class="ttl">Séance recomposée · ${d.timeBudget} min</div><div class="body">J’ai gardé les compounds prioritaires et coupé : ${esc(d.dropped.join(', '))}.</div></div></div>` : ''}
      <ol class="ex-list">${cards}</ol>
      ${finisherCard(d)}
      <button class="btn primary block finish-bar" data-action="finish">Terminer la séance · ${doneCount}/${d.blocks.length} exos</button>
    `;
  }

  function sessionCard(b, i, nBlocks) {
    const ex = S().ex(b.exId);
    if (!ex) return '';
    const last = Logic.lastOccurrence(b.exId);
    const prog = Logic.progression(b.exId);
    const stag = Logic.stagnation(b.exId);
    const done = b.sets.some(s => s.done);
    const target = ex.perLeg ? `${b.sets.length}×${ex.repMin}${ex.repMax !== ex.repMin ? '-' + ex.repMax : ''}/jambe` : `${b.sets.length}×${ex.repMin}${ex.repMax !== ex.repMin ? '-' + ex.repMax : ''}`;

    let wn = 0;
    const glyphs = { warm: 'W', drop: 'D', fail: 'E', amrap: 'A' };
    const setRows = b.sets.map((st, si) => {
      const prev = last && last.entry.sets[si];
      const logged = st.done;
      const type = st.type || 'normal';
      const glyph = type === 'normal' ? String(++wn) : glyphs[type];
      return `<div class="set-row ${logged ? 'logged' : ''} ${type === 'warm' ? 'is-warm' : ''}">
        <button class="sidx type-${type}" data-action="cycle-type" data-b="${i}" data-s="${si}" aria-label="Type de série ${si + 1} — touche pour changer">${glyph}</button>
        <input class="num" inputmode="decimal" data-b="${i}" data-s="${si}" data-f="weight" value="${st.weight ?? ''}" placeholder="${prev ? prev.weight : 'kg'}" aria-label="Poids série ${si + 1}">
        <input class="num" inputmode="numeric" data-b="${i}" data-s="${si}" data-f="reps" value="${st.reps ?? ''}" placeholder="${prev ? prev.reps : ex.repMin}" aria-label="Reps série ${si + 1}">
        <input class="num" inputmode="numeric" data-b="${i}" data-s="${si}" data-f="rir" value="${st.rir ?? ''}" placeholder="RIR" aria-label="RIR série ${si + 1}">
        <button class="set-check ${logged ? 'on' : ''}" data-action="toggle-set" data-b="${i}" data-s="${si}" aria-pressed="${logged}" aria-label="Valider la série ${si + 1}">✓</button>
      </div>`;
    }).join('');

    return `<li class="ex-card ${done ? 'done' : ''}">
      <span class="ord">${i + 1}</span>
      <div class="ex-head">
        ${ILLU.svgFor(ex.pattern, ex.musclePrimary)}
        <div class="grow0">
          <div class="between"><div class="ex-title">${esc(ex.name)}</div>
            <div class="row gap4 noshrink">${ex.elbowUnsafe ? '<span class="avoid-flag">à éviter</span>' : ''}
              <button class="mv" data-action="move-ex" data-b="${i}" data-dir="-1" aria-label="Monter l’exercice" ${i === 0 ? 'disabled' : ''}>▲</button>
              <button class="mv" data-action="move-ex" data-b="${i}" data-dir="1" aria-label="Descendre l’exercice" ${i === nBlocks - 1 ? 'disabled' : ''}>▼</button>
            </div></div>
          <div class="ex-meta">${esc(ex.musclePrimary)} · ${esc(ex.equipment)}${b.substitutedFrom ? ' · remplacé' : ''}${b.superset ? ' · superset' : ''}</div>
          <div class="ex-target num">Cible ${target}</div>
          ${b.note ? `<div class="ex-note-line">✎ ${esc(b.note)}</div>` : ''}
        </div>
      </div>
      <div class="pips" data-pips="${i}">${b.sets.map(st => `<i class="${st.done ? 'on' : ''}"></i>`).join('')}<span class="cnt">${b.sets.filter(st => st.done).length}/${b.sets.length}</span></div>
      <div class="set-row"><span class="colhead">série</span><span class="colhead">kg</span><span class="colhead">reps</span><span class="colhead">rir</span><span></span></div>
      ${setRows}
      ${i === 0 ? '<div class="type-hint">Touche le numéro d’une série pour la marquer échauffement · drop · échec · AMRAP.</div>' : ''}
      ${deltaLine(b, last)}
      ${prog ? `<div class="suggestion">${esc(prog.label)}</div>` : ''}
      ${stag ? `<div class="suggestion warn">${esc(stag.label)}</div>` : ''}
      <div class="ex-actions">
        <button class="btn sm ghost" data-action="warmup" data-b="${i}">+ échauffement</button>
        <button class="btn sm ghost" data-action="add-set" data-b="${i}">+ série</button>
        <button class="btn sm ghost" data-action="del-set" data-b="${i}">− série</button>
        ${ex.equipment === 'barre' ? `<button class="btn sm ghost" data-action="plates" data-b="${i}">Plaques</button>` : ''}
        <button class="btn sm ghost" data-action="superset" data-b="${i}">Superset</button>
        <button class="btn sm ghost" data-action="ex-note" data-b="${i}">Note${b.note ? ' •' : ''}</button>
        <button class="btn sm steel" data-action="substitute" data-b="${i}">Machine prise</button>
      </div>
    </li>`;
  }

  function deltaLine(b, last) {
    if (!last) return '<div class="delta flat">Première fois sur cet exercice — on pose la référence.</div>';
    const curBest = Math.max(...b.sets.map(s => (s.done && s.type !== 'warm') ? (s.weight || 0) * (s.reps || 0) : 0), 0);
    const prevBest = Math.max(...last.entry.sets.map(s => s.type === 'warm' ? 0 : (s.weight || 0) * (s.reps || 0)), 0);
    if (!curBest) {
      const t = last.entry.sets.find(s => s.weight) || last.entry.sets[0];
      return `<div class="delta flat">Dernière fois · ${t ? `${t.weight ?? '—'} kg × ${t.reps ?? '—'}` : '—'}</div>`;
    }
    const diff = curBest - prevBest;
    const cls = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
    const sign = diff > 0 ? '▲' : diff < 0 ? '▼' : '=';
    return `<div class="delta ${cls}">${sign} ${diff > 0 ? '+' : ''}${diff} vs dernière (volume meilleure série)</div>`;
  }

  function finisherCard(d) {
    const c = d.cardio;
    return `<div class="card pad mt14">
      <div class="between"><div class="eyebrow">Finisher cardio</div>
        <button class="set-check ${c.done ? 'on' : ''}" data-action="toggle-cardio" aria-label="Cardio fait" >✓</button></div>
      <div class="ex-meta mt6 mb12">Marche inclinée · faible impact, préserve la récupération</div>
      <label class="field"><span>Durée · <b class="num" id="cardio-dur-val">${c.duration}</b> min</span>
        <input type="range" min="20" max="30" step="1" value="${c.duration}" data-action="cardio-dur"></label>
      <div class="row mt12">
        <label class="field grow"><span>Inclinaison %</span><input class="num" inputmode="decimal" value="${c.incline}" data-action="cardio-incline"></label>
        <label class="field grow"><span>Vitesse km/h</span><input class="num" inputmode="decimal" value="${c.speed}" data-action="cardio-speed"></label>
      </div>
    </div>`;
  }

  // =====================================================================
  //  VOLUME hebdomadaire — carte musculaire + barres
  // =====================================================================
  const zoneFill = (z) => z === 'over' ? 'var(--danger)' : z === 'high' ? 'var(--amber)' : z === 'ok' ? 'var(--signal)' : z === 'building' ? 'var(--steel)' : 'var(--line)';
  // Corps schématiques (face + dos), chaque groupe teinté par sa zone de volume.
  function bodyMapSVG(zmap) {
    const f = (m) => zoneFill(zmap[m] || 'low');
    const N = 'var(--line)';
    return `<svg class="bodymap" viewBox="0 0 170 150" role="img" aria-label="Carte des muscles travaillés cette semaine">
      <g>
        <circle cx="45" cy="15" r="8" fill="${N}"/>
        <rect x="28" y="26" width="9" height="9" rx="3" fill="${f('Épaules')}"/><rect x="53" y="26" width="9" height="9" rx="3" fill="${f('Épaules')}"/>
        <rect x="35" y="27" width="20" height="13" rx="4" fill="${f('Pectoraux')}"/>
        <rect x="26" y="35" width="7" height="16" rx="3" fill="${f('Biceps')}"/><rect x="57" y="35" width="7" height="16" rx="3" fill="${f('Biceps')}"/>
        <rect x="37" y="41" width="16" height="16" rx="3" fill="${f('Abdos')}"/>
        <rect x="36" y="59" width="8" height="28" rx="4" fill="${f('Quadriceps')}"/><rect x="46" y="59" width="8" height="28" rx="4" fill="${f('Quadriceps')}"/>
        <rect x="37" y="89" width="7" height="20" rx="3" fill="${f('Mollets')}"/><rect x="46" y="89" width="7" height="20" rx="3" fill="${f('Mollets')}"/>
        <text x="45" y="128" text-anchor="middle" class="bm-lab">Face</text>
      </g>
      <g transform="translate(80,0)">
        <circle cx="45" cy="15" r="8" fill="${N}"/>
        <rect x="33" y="25" width="24" height="23" rx="5" fill="${f('Dos')}"/>
        <rect x="26" y="35" width="7" height="16" rx="3" fill="${f('Triceps')}"/><rect x="57" y="35" width="7" height="16" rx="3" fill="${f('Triceps')}"/>
        <rect x="35" y="50" width="20" height="12" rx="4" fill="${f('Fessiers')}"/>
        <rect x="36" y="64" width="8" height="24" rx="4" fill="${f('Ischios')}"/><rect x="46" y="64" width="8" height="24" rx="4" fill="${f('Ischios')}"/>
        <rect x="37" y="90" width="7" height="19" rx="3" fill="${f('Mollets')}"/><rect x="46" y="90" width="7" height="19" rx="3" fill="${f('Mollets')}"/>
        <text x="45" y="128" text-anchor="middle" class="bm-lab">Dos</text>
      </g>
    </svg>`;
  }
  function viewVolume() {
    const rows = Logic.weeklyVolume();
    const max = 26;
    const zmap = {}; rows.forEach(r => zmap[r.muscle] = r.zone);
    const zoneLabel = { low: 'sous la cible', building: 'en construction', ok: 'zone réaliste', high: 'haut de fourchette', over: 'rendement décroissant' };
    return `
    <h1 class="mb4">Volume de la semaine</h1>
    <p class="muted lead">Séries travaillées par muscle. Cible 12–24 ; en déficit, vise la zone réaliste 12–18. Au-delà de 20–22, rendement décroissant.</p>
    <div class="card pad mb14">
      <div class="musclemap">${bodyMapSVG(zmap)}</div>
      <div class="bm-legend">
        <span><i class="z-building"></i>en construction</span>
        <span><i class="z-ok"></i>réaliste</span>
        <span><i class="z-high"></i>haut</span>
        <span><i class="z-over"></i>rendement ↓</span>
      </div>
    </div>
    <div class="card pad">
      ${rows.map(r => {
        const pct = Math.min(100, r.sets / max * 100);
        const zStart = 12 / max * 100, zEnd = 18 / max * 100;
        return `<div class="vol-row">
          <div class="name">${esc(r.muscle)}</div>
          <div class="vol-bar"><span class="zone" style="left:${zStart}%;width:${zEnd - zStart}%"></span><span class="fill ${r.zone}" style="width:${pct}%"></span></div>
          <div class="count">${r.sets}</div>
        </div>
        <div class="vol-zone">${zoneLabel[r.zone]}</div>`;
      }).join('')}
    </div>
    <p class="muted foot">La bande claire marque la zone 12–18 séries. Le compteur ne fait pas de morale : il rend visible où va réellement ton volume.</p>`;
  }

  // =====================================================================
  //  BIBLIOTHÈQUE — CRUD complet
  // =====================================================================
  let libFilter = '';
  let libTab = 'prog'; // 'prog' | 'seances' | 'exos'
  function viewTrain() {
    return `
    <div class="between mb12"><h1>Programme</h1>
      ${libTab === 'exos' ? '<button class="btn primary sm" data-action="new-exercise">+ Exercice</button>' : ''}</div>
    <div class="seg2 mb14" data-seg="lib" data-i="${['prog', 'seances', 'exos'].indexOf(libTab)}">
      <button class="seg-btn ${libTab === 'prog' ? 'on' : ''}" data-action="lib-tab" data-tab="prog">Mon programme</button>
      <button class="seg-btn ${libTab === 'seances' ? 'on' : ''}" data-action="lib-tab" data-tab="seances">Séances</button>
      <button class="seg-btn ${libTab === 'exos' ? 'on' : ''}" data-action="lib-tab" data-tab="exos">Exercices</button>
    </div>
    ${libTab === 'prog' ? trainPrograms() : libTab === 'seances' ? libSeances() : libExercises()}`;
  }

  // Segment « Mon programme » : programme actif + bibliothèque de programmes + édition.
  function trainPrograms() {
    const s = S().settings; const active = Store.activeProgram();
    const sessions = Store.currentOrder() || [];
    return `
    <div class="card pad active-prog">
      <div class="eyebrow">Programme actif</div>
      <div class="name">${esc(active.name)}</div>
      <div class="sub">${esc(active.days)} · ${sessions.length} séances</div>
      <div class="row mt14 gap8">
        <button class="btn sm" data-action="prog-detail" data-id="${esc(active.id)}">Le pourquoi</button>
        <button class="btn sm solid" data-nav="program">Éditer mes séances</button>
      </div>
    </div>

    <div class="eyebrow h-sec">Changer de programme</div>
    <div class="stack">
      ${Store.allPrograms().map(pr => { const on = s.programId === pr.id; return `<div class="prog-pick ${on ? 'on' : ''}">
        <button data-action="set-program" data-id="${pr.id}">
          <div class="between"><b>${esc(pr.name)}</b>${on ? '<span class="chip ok fs10">Actif</span>' : `<span class="badge-eq">${esc(pr.days)}</span>`}</div>
          <div class="ex-meta mt3">${esc(pr.mode)}</div>
          <div class="ex-meta mt4">${esc(pr.desc)}${pr.custom ? ` · <b>${(S().programs[pr.id] || []).length} séance(s)</b>` : ''}</div>
        </button>
        <div class="row mt10 gap6">
          <button class="btn ghost sm" data-action="prog-detail" data-id="${pr.id}">Le pourquoi</button>
          ${pr.custom ? `<button class="btn ghost sm" data-action="prog-edit" data-id="${pr.id}">Éditer</button>
          <button class="btn ghost sm danger" data-action="prog-delete" data-id="${pr.id}">Supprimer</button>` : ''}
        </div>
      </div>`; }).join('')}
      <button class="btn block" data-action="prog-create">+ Créer mon programme</button>
    </div>
    <p class="muted foot">Changer de programme n’efface rien : ton historique reste continu et la rotation repart proprement.</p>`;
  }

  function libExercises() {
    const q = libFilter.toLowerCase();
    const list = S().exercises
      .filter(e => e.musclePrimary !== 'Cardio')
      .filter(e => !q || e.name.toLowerCase().includes(q) || e.musclePrimary.toLowerCase().includes(q))
      .sort((a, b) => (a.archived - b.archived) || a.musclePrimary.localeCompare(b.musclePrimary) || a.name.localeCompare(b.name));
    return `
    <input placeholder="Rechercher un exercice ou un muscle…" value="${esc(libFilter)}" data-action="lib-search" class="mb14">
    <div class="card">
      ${list.map(e => `<div class="lib-item ${e.archived ? 'archived' : ''}">
        ${ILLU.svgFor(e.pattern, e.musclePrimary)}
        <div class="grow0">
          <div class="ex-title fs15">${esc(e.name)} ${e.elbowUnsafe ? '<span class="avoid-flag">à éviter</span>' : ''}</div>
          <div class="ex-meta"><span class="badge-eq">${esc(e.equipment)}</span> · ${esc(e.musclePrimary)} · ${e.repMin}-${e.repMax} reps${e.custom ? ' · custom' : ''}${e.archived ? ' · archivé' : ''}</div>
        </div>
        <button class="btn ghost sm" data-action="edit-exercise" data-id="${e.id}">Éditer</button>
      </div>`).join('')}
    </div>`;
  }

  const CODE_LABEL = { PUSH: 'Poussée (pecs · épaules · triceps)', PULL: 'Tirage (dos · biceps)', LEGS: 'Jambes', UPPER: 'Haut du corps', LOWER: 'Bas du corps', FULL: 'Full body', HAUT: 'Torse (pecs + dos)', BRAS: 'Épaules & bras' };
  function libSeances() {
    const prog = Store.activeProgram();
    const sessions = Store.currentOrder();
    const groups = {}; const order = [];
    sessions.forEach(t => { if (!groups[t.code]) { groups[t.code] = []; order.push(t.code); } groups[t.code].push(t); });
    return `
    <div class="card pad" style="margin-bottom:6px;display:flex;justify-content:space-between;align-items:center">
      <div><div class="eyebrow">Programme actif</div><div class="ex-title fs15">${esc(prog.name)}</div><div class="ex-meta">${esc(prog.days)}</div></div>
      <button class="btn ghost sm" data-action="prog-detail" data-id="${prog.id}">Le pourquoi</button>
    </div>
    ${order.map(code => `<div class="eyebrow h-sec">${esc(CODE_LABEL[code] || code)}</div>
      <div class="card">${groups[code].map(t => `<div class="lib-item prog-row" data-action="preview-session" data-id="${esc(t.id)}">
        ${ILLU.svgFor(t.blocks[0] && (S().ex(t.blocks[0].exId) || {}).pattern || 'isolation', '')}
        <div class="grow0"><div class="ex-title fs15">${esc(t.name)}</div><div class="ex-meta">${esc(t.focus)} · ${t.blocks.length} exos · ~${Logic.estimateMinutes(t.blocks)} min</div></div>
        <span class="badge-eq">Aperçu ▸</span></div>`).join('')}</div>`).join('')}
    <p class="muted foot">Touche une séance pour la prévisualiser en entier, puis la lancer directement. Pour changer de programme : segment « Mon programme ».</p>`;
  }

  function openSessionPreview(id) {
    const t = Store.templateById(id); if (!t) return;
    const isActive = Store.currentOrder().some(x => x.id === id);
    const rows = t.blocks.map((b, i) => {
      const ex = S().ex(b.exId); if (!ex) return '';
      const rng = `${ex.repMin}${ex.repMax !== ex.repMin ? '-' + ex.repMax : ''}`;
      const target = ex.perLeg ? `${b.sets}×${rng}/j` : `${b.sets}×${rng}`;
      return `<div class="lib-item"><span class="prev-ord num">${i + 1}</span>${ILLU.svgFor(ex.pattern, ex.musclePrimary)}
        <div class="grow0"><div class="ex-title fs14">${esc(ex.name)}${ex.elbowUnsafe ? ' <span class="avoid-flag">à éviter</span>' : ''}</div><div class="ex-meta">${esc(ex.musclePrimary)} · ${esc(ex.equipment)}</div></div>
        <div class="ex-target num">${target}</div></div>`;
    }).join('');
    openSheet(`<div class="grab"></div>
      <div class="eyebrow">${esc(CODE_LABEL[t.code] || t.code)}</div>
      <h2 class="mt2 mb4">${esc(t.name)}</h2>
      <div class="ex-meta">${esc(t.focus)} · ~${Logic.estimateMinutes(t.blocks)} min · ${t.blocks.length} exercices</div>
      ${t.note ? `<details class="why" open style="margin-top:12px"><summary>Pourquoi cet ordre ?</summary><p>${esc(t.note)}</p></details>` : ''}
      <div class="card mt12">${rows}</div>
      ${isActive ? `<button class="btn primary block mt14" data-action="do-session" data-id="${esc(id)}">Mettre cette séance à aujourd’hui</button>` : '<p class="muted" style="font-size:12px;text-align:center;margin-top:12px">Aperçu — active ce programme dans « Mon programme » pour la faire.</p>'}`);
  }

  function exerciseForm(ex) {
    const patterns = [['push-h', 'Poussée horizontale'], ['push-v', 'Poussée verticale'], ['pull-h', 'Tirage horizontal'], ['pull-v', 'Tirage vertical'], ['hinge', 'Hinge (charnière)'], ['squat', 'Squat'], ['curl', 'Curl'], ['extension', 'Extension'], ['isolation', 'Isolation (autre)']];
    const equips = ['haltère', 'barre', 'câble', 'machine', 'poids du corps'];
    const isNew = !ex;
    ex = ex || { id: '', name: '', musclePrimary: 'Pectoraux', equipment: 'haltère', pattern: 'push-h', repMin: 8, repMax: 12, role: 'isolation', elbowSensitive: false, elbowUnsafe: false, tips: [], biomech: '', archived: false, custom: true, restSec: null };
    return `<div class="grab"></div>
      <h2 class="mb4">${isNew ? 'Nouvel exercice' : 'Éditer l’exercice'}</h2>
      <p class="muted" style="font-size:13px;margin:0 0 16px">${isNew ? 'Son illustration sera générée automatiquement depuis le pattern choisi.' : 'Tu peux modifier chaque champ, y compris sur un exercice de base.'}</p>
      <div class="row" style="align-items:center;margin-bottom:14px"><div id="form-illu">${ILLU.svgFor(ex.pattern, ex.musclePrimary)}</div><span class="muted fs12">Aperçu du schéma généré</span></div>
      <div class="stack">
        <label class="field"><span>Nom</span><input id="f-name" value="${esc(ex.name)}"></label>
        <div class="row">
          <label class="field grow"><span>Muscle principal</span><select id="f-muscle">${DATA.MUSCLE_GROUPS.map(m => `<option ${m === ex.musclePrimary ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
          <label class="field grow"><span>Équipement</span><select id="f-equip">${equips.map(m => `<option ${m === ex.equipment ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
        </div>
        <label class="field"><span>Pattern de mouvement (définit l’illustration)</span><select id="f-pattern" data-action="pattern-change">${patterns.map(([v, l]) => `<option value="${v}" ${v === ex.pattern ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <div class="row">
          <label class="field grow"><span>Reps min</span><input class="num" inputmode="numeric" id="f-repmin" value="${ex.repMin}"></label>
          <label class="field grow"><span>Reps max</span><input class="num" inputmode="numeric" id="f-repmax" value="${ex.repMax}"></label>
          <label class="field grow"><span>Rôle</span><select id="f-role"><option value="compound" ${ex.role === 'compound' ? 'selected' : ''}>Compound</option><option value="isolation" ${ex.role === 'isolation' ? 'selected' : ''}>Isolation</option></select></label>
        </div>
        <label class="field"><span>Repos entre séries (s) — vide = réglage global</span><input class="num" inputmode="numeric" id="f-rest" value="${ex.restSec ?? ''}" placeholder="${(S().settings.restByRole[ex.role] || 120)}"></label>
        <label class="field"><span>Note biomécanique (courte)</span><textarea id="f-bio" rows="2">${esc(ex.biomech || '')}</textarea></label>
        <label class="field"><span>Tips d’exécution (une ligne chacun)</span><textarea id="f-tips" rows="3">${esc((ex.tips || []).join('\n'))}</textarea></label>
        <label class="row gap8"><input type="checkbox" id="f-elbow" class="w-auto" ${ex.elbowSensitive ? 'checked' : ''}><span class="fs13">Coude sensible (rappel mobilité pendant le repos)</span></label>
        <label class="row gap8"><input type="checkbox" id="f-unsafe" class="w-auto" ${ex.elbowUnsafe ? 'checked' : ''}><span class="fs13">Élongation contre-indiquée coude (marqué « à éviter »)</span></label>
      </div>
      <div class="row mt18">
        <button class="btn primary block" data-action="save-exercise" data-id="${esc(ex.id)}">${isNew ? 'Créer l’exercice' : 'Enregistrer'}</button>
      </div>
      ${!isNew ? `<button class="btn block ${ex.archived ? 'steel' : 'danger'} mt10" data-action="archive-exercise" data-id="${esc(ex.id)}">${ex.archived ? 'Réactiver l’exercice' : 'Archiver (garde l’historique lisible)'}</button>` : ''}`;
  }

  // =====================================================================
  //  PROGRÈS — courbes par exercice, régularité, records, historique
  // =====================================================================
  // Sparkline SVG (courbe + endpoint marqué), langage "relevé d'instrument".
  function sparkSVG(vals, w, h, color) {
    color = color || 'var(--signal)';
    if (!vals || !vals.length) return '';
    let v = vals.slice(); if (v.length === 1) v = [v[0], v[0]];
    const min = Math.min(...v), max = Math.max(...v), rng = (max - min) || 1, n = v.length;
    const pts = v.map((val, i) => [(i / (n - 1)) * w, h - 4 - ((val - min) / rng) * (h - 8)]);
    const poly = pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const e = pts[pts.length - 1];
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" aria-hidden="true">
      <polyline points="${poly}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${e[0].toFixed(1)}" cy="${e[1].toFixed(1)}" r="3" fill="${color}"/></svg>`;
  }

  // Une baisse de poids n'est un progrès que si c'est l'objectif (sèche, recomposition) ;
  // en prise de masse c'est la hausse ; sans objectif connu, on reste neutre.
  function weightTrend(delta) {
    const goal = (S().settings.profile || {}).goal;
    if (!delta || !goal) return 'flat';
    const wantUp = goal === 'masse';
    return (delta > 0) === wantUp ? 'up' : 'down';
  }
  function viewProgress() {
    const days = Logic.regularityDays(4);
    const today = new Date().toDateString();
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
    const doneCount = days.filter(d => d.done).length;
    const perWeek = (doneCount / 4).toFixed(1);

    const prs = [];
    for (const sess of S().sessions) for (const e of (sess.entries || [])) for (const pr of (e.prs || [])) prs.push({ date: sess.date, name: e.resolvedName || (S().ex(e.exId)?.name), pr });
    prs.reverse();

    const exs = Logic.loggedExercises();
    const hist = S().sessions.slice().reverse().slice(0, 12);
    const cons = Logic.consistencyWeeks(8);
    const bs = Logic.bodyStats();
    const rc = Logic.rirCalibration();
    return `
    <h1 class="page-title">Progrès</h1>

    <div class="card pad">
      <div class="between"><div class="eyebrow">Régularité · 4 semaines</div><span class="chip ok num">${perWeek} / sem.</span></div>
      <div class="mt12">${weeks.map(w => `<div class="cal mb6">${w.map(d => `<div class="d ${d.done ? 'done' : ''} ${d.date.toDateString() === today ? 'today' : ''}"></div>`).join('')}</div>`).join('')}</div>
      <div class="cons">
        <div class="cons-band">${cons.weeks.map(w => `<span class="cpip ${w.trained ? 'on' : ''}"></span>`).join('')}</div>
        <div class="cons-msg">${cons.run > 0 ? `${cons.run} semaine${cons.run > 1 ? 's' : ''} active${cons.run > 1 ? 's' : ''} d’affilée` : 'Nouvelle semaine — la première séance relance la dynamique.'}</div>
      </div>
      <p class="muted fs12 mt10">${doneCount} séance${doneCount > 1 ? 's' : ''} sur 4 semaines. Une pause n’efface rien et ne casse aucun compteur — on lit la régularité réelle, sans pression.</p>
    </div>

    <h2 class="h-sec">Corps</h2>
    <div class="card pad">
      <div class="between"><div class="eyebrow">Poids de corps</div><button class="btn ghost sm" data-action="body-add">+ Mesure</button></div>
      ${bs.count ? `
        <div class="row" style="align-items:baseline;gap:12px;margin-top:8px">
          <span class="big-num">${bs.latest.weight != null ? bs.latest.weight : '—'}<span class="u"> kg</span></span>
          ${bs.delta != null ? `<span class="delta ${weightTrend(bs.delta)}">${bs.delta > 0 ? '+' : ''}${bs.delta} kg${bs.spanDays ? ` · ${bs.spanDays} j` : ''}</span>` : ''}
        </div>
        ${bs.series.length > 1 ? `<div class="mt10">${sparkSVG(bs.series, 260, 60, 'var(--steel)')}</div>` : ''}
        ${Object.keys(bs.latest.measures || {}).length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px">${Object.entries(bs.latest.measures).map(([k, v]) => `<span class="chip ghost">${esc(k)} ${v} cm</span>`).join('')}</div>` : ''}
      ` : `<div class="empty pad14"><div class="big">Aucune mesure</div>Note ton poids pour suivre la tendance, utile en déficit.</div>`}
    </div>

    ${rc.samples >= 3 ? `<h2 class="h-sec">Calibration RIR</h2>
    <div class="card pad">
      <div class="between"><div class="eyebrow">Précision de ton ressenti</div><span class="chip ${rc.bias >= 1.5 ? 'warn' : 'ok'} num">${rc.bias >= 1.5 ? 'à ajuster' : 'fiable'}</span></div>
      <p class="muted fs13 mt8">Sur tes ${rc.samples} séries menées à l’échec, tu annonçais en moyenne <b class="num">RIR ${rc.bias}</b>. ${rc.bias >= 1.5 ? `Tu surestimes tes reps en réserve d’environ ${Math.round(rc.bias)} — pousse un peu plus près de l’échec, surtout sur les isolations.` : 'Ton ressenti colle à la réalité — continue comme ça.'}</p>
    </div>` : ''}

    <h2 class="h-sec">Outils</h2>
    <div class="card pad"><div class="between"><div><div class="ex-title fs14">Calculateur 1RM &amp; %</div><div class="ex-meta">Estime ton max et la charge à chaque pourcentage.</div></div><button class="btn sm steel" data-action="one-rm">Ouvrir</button></div></div>

    <h2 class="h-sec">Progression par exercice</h2>
    ${exs.length ? `<div class="card">${exs.map(x => {
      const ser = Logic.e1rmSeries(x.id); const vals = ser.map(p => p.value);
      const first = vals[0] || 0, lastV = vals[vals.length - 1] || 0; const pct = first ? Math.round((lastV - first) / first * 100) : 0;
      return `<div class="lib-item prog-row" data-action="ex-progress" data-id="${x.id}">
        <div class="grow0"><div class="ex-title fs14">${esc(x.ex.name)}</div><div class="ex-meta">1RM est. ${lastV.toFixed(0)} kg · ${ser.length} séance${ser.length > 1 ? 's' : ''}</div></div>
        <div class="prog-spark">${sparkSVG(vals, 120, 34)}</div>
        <div class="delta ${pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat'} noshrink">${pct > 0 ? '+' : ''}${pct}%</div>
      </div>`;
    }).join('')}</div>` : `<div class="empty">Tes courbes de progression apparaîtront ici après quelques séances.</div>`}

    <h2 class="h-sec">Records</h2>
    ${prs.length ? `<div class="card">${prs.slice(0, 8).map(p => `<div class="lib-item"><span class="chip pr">PR</span><div class="grow"><div class="ex-title fs14">${esc(p.name)}</div><div class="ex-meta">${esc(p.pr.label)}</div></div><div class="muted num fs11">${fmtDate(p.date)}</div></div>`).join('')}</div>` : `<div class="empty">Tes records apparaîtront ici dès ta première séance loggée.</div>`}

    <h2 class="h-sec">Historique</h2>
    ${hist.length ? `<div class="card">${hist.map(s => `<div class="lib-item prog-row" data-action="session-detail" data-id="${s.id}"><div class="grow0"><div class="ex-title fs14">${esc(s.name)}</div><div class="ex-meta">${s.entries.length} exos · ${s.entries.reduce((a, e) => a + e.sets.filter(x => x.done && x.type !== 'warm').length, 0)} séries${s.checkin ? ' · check-in fait' : ''}${s.note ? ' · ✎' : ''}</div></div><div class="muted num fs11">${fmtDate(s.date)}</div></div>`).join('')}</div>` : `<div class="empty"><div class="big">Aucune séance encore</div>Lance ta première séance depuis l’accueil.</div>`}`;
  }

  function openSessionDetail(id) {
    const s = S().sessions.find(x => x.id === id); if (!s) return;
    const d = new Date(s.date);
    const rows = s.entries.map(e => {
      const work = e.sets.filter(x => x.done && x.type !== 'warm');
      const best = work.reduce((a, x) => (x.weight || 0) * (x.reps || 0) > (a.weight || 0) * (a.reps || 0) ? x : a, work[0] || {});
      return `<div class="lib-item"><div class="grow"><div class="ex-title fs13">${esc(e.resolvedName || (S().ex(e.exId) || {}).name || e.exId)}</div><div class="ex-meta">${work.length} série${work.length > 1 ? 's' : ''}${best && best.weight != null ? ` · top ${best.weight} kg × ${best.reps}` : ''}</div>${e.note ? `<div class="ex-note-line">✎ ${esc(e.note)}</div>` : ''}</div>${(e.prs || []).length ? '<span class="chip pr">PR</span>' : ''}</div>`;
    }).join('');
    openSheet(`<div class="grab"></div>
      <div class="eyebrow">${d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}</div>
      <h2 class="mt2 mb12">${esc(s.name)}</h2>
      ${s.note ? `<div class="banner info mb12"><div><div class="ttl">Note</div><div class="body">${esc(s.note)}</div></div></div>` : ''}
      <div class="card">${rows || '<div class="empty pad12">Séance sans série loggée.</div>'}</div>
      ${s.checkin ? `<div class="ex-meta mt10">Check-in · énergie ${['—', 'basse', 'correcte', 'top'][s.checkin.energy] || '—'} · sommeil ${['—', 'court', 'correct', 'excellent'][s.checkin.sleep] || '—'}</div>` : ''}
      <button class="btn danger block mt16" data-action="session-delete" data-id="${s.id}">Supprimer cette séance</button>
      <p class="muted" style="font-size:11px;text-align:center;margin-top:8px">La rotation n’est pas affectée — seule l’analyse (volume, records) est recalculée.</p>`);
  }

  function openExProgress(id) {
    const ex = S().ex(id); if (!ex) return;
    const ser = Logic.e1rmSeries(id);
    const vals = ser.map(p => p.value), vols = ser.map(p => p.volume);
    const first = vals[0] || 0, lastV = vals[vals.length - 1] || 0, pct = first ? Math.round((lastV - first) / first * 100) : 0;
    openSheet(`<div class="grab"></div>
      <h2 style="font-size:20px">${esc(ex.name)}</h2>
      <div class="ex-meta mt2 mb14">${esc(ex.musclePrimary)} · ${esc(ex.equipment)}</div>
      <div class="card pad"><div class="between"><div class="eyebrow">1RM estimé</div><span class="delta ${pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat'}">${pct > 0 ? '+' : ''}${pct}% · ${lastV.toFixed(1)} kg</span></div>
        <div class="mt10">${sparkSVG(vals, 260, 78)}</div>
        ${ser.length ? `<button class="btn sm ghost mt10" data-action="one-rm-ex" data-id="${esc(id)}">Calculer mes %</button>` : ''}</div>
      <div class="card pad mt12"><div class="eyebrow">Volume par séance</div><div class="mt10">${sparkSVG(vols, 260, 60, 'var(--steel)')}</div></div>
      <h3 style="font-size:15px;margin:16px 2px 8px">Séance par séance</h3>
      <div class="card">${ser.slice().reverse().map(p => `<div class="lib-item"><div class="grow"><div class="ex-title num fs13">${p.top.weight} kg × ${p.top.reps}</div><div class="ex-meta">1RM est. ${p.value.toFixed(1)} kg · volume ${p.volume}</div></div><div class="muted num fs11">${fmtDate(p.date)}</div></div>`).join('')}</div>`);
  }

  // Liste filtrable d'exercices pour l'éditeur de programme.
  function pickList(q) {
    const t = Store.templateById(progEdit); if (!t) return '';
    q = (q || '').toLowerCase();
    const opts = S().exercises.filter(x => !x.archived && x.musclePrimary !== 'Cardio' && !t.blocks.some(b => b.exId === x.id))
      .filter(x => !q || x.name.toLowerCase().includes(q) || x.musclePrimary.toLowerCase().includes(q) || x.equipment.toLowerCase().includes(q))
      .sort((a, b) => a.musclePrimary.localeCompare(b.musclePrimary) || a.name.localeCompare(b.name));
    if (!opts.length) return '<div class="empty pad">Aucun exercice ne correspond.</div>';
    return `<div class="card">${opts.map(x => `<div class="lib-item prog-row" data-action="tpl-add-do" data-id="${x.id}">
      ${ILLU.svgFor(x.pattern, x.musclePrimary)}
      <div class="grow0"><div class="ex-title fs14">${esc(x.name)}</div><div class="ex-meta">${esc(x.musclePrimary)} · ${esc(x.equipment)}</div></div>
      <span class="badge-eq">+</span></div>`).join('')}</div>`;
  }

  function openProgramDetail(id) {
    const pr = Store.allPrograms().find(p => p.id === id); if (!pr) return;
    const sessions = S().programs[id] || [];
    // Couverture musculaire hebdomadaire (prouve que tous les muscles sont sollicités).
    const cov = {}; DATA.MUSCLE_GROUPS.forEach(m => cov[m] = 0);
    for (const t of sessions) for (const b of t.blocks) { const ex = S().ex(b.exId); if (ex && cov[ex.musclePrimary] != null) cov[ex.musclePrimary] += b.sets; }
    const covChips = DATA.MUSCLE_GROUPS.map(m => `<span class="chip ${cov[m] >= 8 ? 'ok' : cov[m] >= 4 ? '' : 'ghost'}" style="font-size:10.5px">${esc(m)} ${cov[m]}</span>`).join(' ');
    const active = S().settings.programId === id;
    openSheet(`<div class="grab"></div>
      <div class="eyebrow">${esc(pr.mode)}</div>
      <h2 style="font-size:22px;margin:2px 0 6px">${esc(pr.name)} · ${esc(pr.days)}</h2>
      <p class="muted" style="font-size:13px;margin:0 0 12px">${esc(pr.rationale)}</p>
      <div class="card pad mb12"><div class="eyebrow mb8">Volume hebdo par muscle (séries)</div><div class="wrap">${covChips}</div><p class="muted" style="font-size:11px;margin:10px 0 0">Tous les groupes sont couverts sur la semaine, y compris mollets et abdos.</p></div>
      <div class="eyebrow mt4 mb8">Les séances &amp; leur logique</div>
      ${sessions.map(t => `<div class="card pad mb8"><div class="between"><b class="fs14">${esc(t.name)}</b><span class="num muted fs11">~${Logic.estimateMinutes(t.blocks)} min</span></div><div class="ex-meta mt2">${esc(t.focus)}</div>${t.note ? `<div class="ex-meta mt6">${esc(t.note)}</div>` : ''}</div>`).join('')}
      ${active ? '<div class="chip ok mt8">Programme actif</div>' : `<button class="btn primary block mt12" data-action="set-program" data-id="${id}">Choisir ce programme</button>`}`);
  }

  // 1RM (Epley) + table de chargement en %
  function ormTable(w, reps, eq) {
    const oneRM = Logic.e1rm(num(w), num(reps));
    if (!oneRM) return '<div class="empty pad12">Entre un poids et des reps pour estimer ton max.</div>';
    const rows = [[100, 1], [95, 2], [90, 4], [85, 6], [80, 8], [75, 10], [70, 12], [67, 15]];
    return `<div class="orm-1rm">1RM estimé · <b class="num">${oneRM.toFixed(1)} kg</b></div>
      <div class="orm-table">${rows.map(([pct, r]) => {
        const load = Logic.roundToIncrement(oneRM * pct / 100, eq);
        return `<div class="orm-row"><span class="num" style="color:var(--accent-steel)">${pct}%</span><span class="num fw7">${load} kg</span><span class="muted num">~${r} rep${r > 1 ? 's' : ''}</span></div>`;
      }).join('')}</div>`;
  }
  function openOneRM(prefW, prefR, eq) {
    eq = eq || 'barre';
    openSheet(`<div class="grab"></div><h2>Calculateur 1RM &amp; %</h2>
      <p class="muted lead">Estime ton max (formule d’Epley) et la charge à chaque %, arrondie à tes incréments.</p>
      <div class="row">
        <label class="field grow"><span>Poids (kg)</span><input class="num" inputmode="decimal" id="orm-w" value="${prefW ?? ''}" data-action="orm"></label>
        <label class="field grow"><span>Reps</span><input class="num" inputmode="numeric" id="orm-r" value="${prefR ?? ''}" data-action="orm"></label>
      </div>
      <label class="field mt10"><span>Arrondir comme</span><select id="orm-eq" data-action="orm">${['barre', 'haltère', 'machine', 'câble'].map(x => `<option ${x === eq ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <div id="orm-out" class="mt16">${ormTable(prefW, prefR, eq)}</div>`);
  }

  // Plate calculator (barre)
  function plateHTML(weight) {
    const pc = Logic.plateCalc(num(weight) || 0, 'barre');
    if (!pc) return '';
    if (pc.tooLight) return `<div class="empty">La cible est sous le poids de la barre (${pc.bar} kg).</div>`;
    const discs = pc.perSide.flatMap(x => Array.from({ length: x.count }, () => x.plate));
    const bars = discs.map(p => `<div class="disc" style="height:${Math.round(26 + (p / 25) * 34)}px"><span>${p}</span></div>`).join('');
    const list = pc.perSide.map(x => `${x.count}×${x.plate}`).join(' · ') || 'barre seule';
    return `<div class="plate-visual"><div class="plate-sleeve"></div>${bars}<div class="plate-collar"></div></div>
      <div class="platelist num mt10">${pc.ok ? '' : '≈ '}${pc.loaded} kg = barre ${pc.bar} + <b>${list}</b> / côté</div>
      ${pc.ok ? '' : '<div class="muted" style="font-size:12px;text-align:center;margin-top:6px">Charge exacte non atteignable avec tes disques — voici le plus proche en dessous.</div>'}`;
  }
  function openPlateSheet(weight, ex) {
    openSheet(`<div class="grab"></div><h2>Plate calculator</h2>
      <p class="muted lead">${esc(ex.name)} · barre ${S().settings.barWeight} kg. Disques à charger par côté.</p>
      <label class="field"><span>Charge cible (kg)</span><input class="num" inputmode="decimal" id="plate-target" value="${weight || ''}" data-action="plate-target"></label>
      <div id="plate-out" class="mt16">${plateHTML(weight)}</div>`);
  }

  const fmtDate = (iso) => { const d = new Date(iso); return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }); };

  // =====================================================================
  //  RÉGLAGES / PLUS
  // =====================================================================
  const themePref = () => { try { const t = localStorage.getItem('chrono-theme'); return t === 'light' || t === 'dark' ? t : 'auto'; } catch (e) { return 'auto'; } };
  // ---- bip de fin de repos (WebAudio : aucun fichier, hors-ligne) ----
  const soundOn = () => { try { return localStorage.getItem('chrono-sound') !== 'off'; } catch (e) { return true; } };
  let audioCtx = null;
  // À appeler dans un geste utilisateur (tap sur ✓) : iOS n'autorise le son qu'à cette condition.
  function armSound() {
    if (!soundOn()) return;
    try { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; if (!audioCtx) audioCtx = new AC(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) {}
  }
  function beep() {
    if (!soundOn() || !audioCtx || audioCtx.state !== 'running') return;
    try {
      [0, 0.22].forEach((at, k) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain(), t = audioCtx.currentTime + at;
        o.type = 'sine'; o.frequency.value = k ? 1175 : 880;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + 0.18);
      });
    } catch (e) {}
  }
  function viewMore() {
    const s = S().settings;
    return `
    <h1 class="page-title">Réglages</h1>

    <div class="card pad stack mb14">
      <div class="eyebrow">Apparence</div>
      <div class="seg2 theme-seg" data-seg="theme" data-i="${['auto', 'light', 'dark'].indexOf(themePref())}">
        ${[['auto', 'Auto'], ['light', 'Clair'], ['dark', 'Sombre']].map(([v, l]) => `<button class="seg-btn ${themePref() === v ? 'on' : ''}" data-action="theme" data-v="${v}">${l}</button>`).join('')}
      </div>
      <p class="muted fine">Auto suit le réglage de ton téléphone.</p>
    </div>

    <div class="card pad stack">
      <div class="eyebrow">Pendant la séance</div>
      <label class="row gap8"><input type="checkbox" data-action="sound" ${soundOn() ? 'checked' : ''}><span class="fs14">Bip à la fin du repos</span></label>
      <p class="muted fine">Deux bips courts quand le chrono arrive à zéro. Suit le bouton silencieux du téléphone. L’écran reste allumé pendant toute la séance.</p>
    </div>

    <div class="card pad stack mt14">
      <div class="eyebrow">Incréments disponibles en salle</div>
      <p class="muted fine">Les suggestions de charge s’arrondiront à ces pas.</p>
      ${Object.entries(s.increments).map(([k, v]) => `<label class="field"><span>${esc(k)} — pas (kg)</span><input class="num" inputmode="decimal" value="${v}" data-action="increment" data-k="${esc(k)}"></label>`).join('')}
    </div>

    <div class="card pad stack mt14">
      <div class="eyebrow">Barre & disques</div>
      <p class="muted fine">Sert au calcul des disques pendant la séance.</p>
      <label class="field"><span>Poids de la barre (kg)</span><input class="num" inputmode="decimal" value="${s.barWeight}" data-action="barweight"></label>
      <label class="field"><span>Disques disponibles (kg, séparés par des virgules)</span><input class="num" value="${(s.plates || []).join(', ')}" data-action="plates-setting"></label>
    </div>

    <div class="card pad stack mt14">
      <div class="eyebrow">Temps de repos (secondes)</div>
      <div class="row">
        <label class="field grow"><span>Compounds</span><input class="num" inputmode="numeric" value="${s.restByRole.compound}" data-action="rest" data-k="compound"></label>
        <label class="field grow"><span>Isolations</span><input class="num" inputmode="numeric" value="${s.restByRole.isolation}" data-action="rest" data-k="isolation"></label>
      </div>
    </div>

    <div class="card pad stack mt14">
      <div class="eyebrow">Plans & rappels</div>
      <p class="muted fine">« Si [jour · heure], alors ta séance. » Le rappel s’accroche à ce moment — notification locale, aucun serveur.</p>
      ${(s.plans && s.plans.length) ? `<div style="display:flex;flex-direction:column;gap:8px">${s.plans.slice().sort((a, b) => a.day - b.day || a.time.localeCompare(b.time)).map(p => `<div class="plan-item"><div class="fs13"><b>${DAY_NAMES[p.day]}</b> · <span class="num">${p.time}</span>${p.anchor ? ` · <span class="muted">${esc(p.anchor)}</span>` : ''}</div><button class="btn ghost sm danger" data-action="plan-remove" data-id="${esc(p.id)}">✕</button></div>`).join('')}</div>` : '<div class="muted fs12">Aucun plan pour l’instant.</div>'}
      <button class="btn block" data-action="add-plan">+ Ajouter un plan</button>
      <button class="btn block" data-action="enable-reminder">${(typeof Notification !== 'undefined' && Notification.permission === 'granted') ? 'Rappels activés ✓' : 'Activer les rappels'}</button>
    </div>

    <div class="card pad stack mt14">
      <div class="eyebrow">Deload</div>
      <button class="btn block" data-action="apply-deload">Appliquer une semaine de deload (−40%)</button>
    </div>

    <div class="card pad stack mt14">
      <div class="eyebrow">Données</div>
      <button class="btn block" data-action="export">Exporter mes données (JSON)</button>
      <button class="btn block" data-action="import">Importer une sauvegarde</button>
    </div>

    <div class="card pad stack mt14">
      <div class="eyebrow">Labo · expérimental</div>
      <p class="muted fine">Coach Silencieux : compte tes reps par la caméra, 100 % sur l’appareil, rien n’est enregistré. Bêta.</p>
      <a class="btn block" href="./proto/coach-silencieux.html" style="text-decoration:none;display:flex;align-items:center;justify-content:center">Ouvrir le Coach Silencieux ▸</a>
    </div>

    <div class="card pad stack mt14">
      <div class="eyebrow">Repas</div>
      <div class="empty pad12"><div class="big">Bientôt disponible</div>Le suivi des repas arrivera dans une prochaine version.</div>
    </div>

    <div class="card pad stack mt14">
      <div class="eyebrow">Version & mises à jour</div>
      <div class="between"><span class="num fw7">Version ${window.APP_VERSION || '—'}</span>
        <button class="btn ghost sm" data-action="check-updates">Vérifier les mises à jour</button></div>
      <p class="muted fine">L’app se met à jour toute seule à la réouverture. Ce bouton force la vérification. Tes données restent intactes.</p>
    </div>

    <button class="btn danger block mt18" data-action="reset">Réinitialiser l’application</button>
    <p class="muted" style="font-size:11px;text-align:center;margin-top:18px">Chronographe · 100% local · aucune donnée ne quitte ton téléphone.</p>`;
  }

  // =====================================================================
  //  ÉDITEUR DE PROGRAMME (réordonner / ajouter / retirer / séries)
  // =====================================================================
  let progEdit = null;      // templateId en cours d'édition
  let pendingProgram = null; // programme visé par l'éditeur (perso fraîchement créé)
  let lastPickQuery = null;  // dernière requête du sélecteur d'exercices
  function viewProgram() {
    const pid = pendingProgram || S().settings.programId;
    const order = S().programs[pid] || [];
    const meta = Store.allPrograms().find(p => p.id === pid) || Store.activeProgram();
    if (!progEdit) {
      return `<div class="between mb12"><h1>Mes séances</h1><button class="btn ghost sm" data-nav="train">Retour</button></div>
      <p class="muted" style="font-size:13px;margin:0 0 14px">Programme : <b>${esc(meta.name)}</b>${pid !== S().settings.programId ? ' <span class="chip ghost fs10">non actif</span>' : ''}. Touche une séance pour ajuster ses exercices, ou crée la tienne.</p>
      ${order.length ? `<div class="card">${order.map(t => `<div class="lib-item">
        <div class="grow0"><div class="ex-title fs15">${esc(t.name)}</div><div class="ex-meta">${t.blocks.length} exercices · ~${Logic.estimateMinutes(t.blocks)} min${t.focus ? ' · ' + esc(t.focus) : ''}</div></div>
        <button class="btn ghost sm" data-action="tpl-dup" data-id="${t.id}" aria-label="Dupliquer">⧉</button>
        <button class="btn ghost sm danger" data-action="tpl-del" data-id="${t.id}" aria-label="Supprimer">✕</button>
        <button class="btn ghost sm" data-action="edit-template" data-id="${t.id}">Éditer</button></div>`).join('')}</div>`
        : '<div class="empty"><div class="big">Aucune séance</div>Crée ta première séance ci-dessous.</div>'}
      <button class="btn primary block mt14" data-action="tpl-new">+ Créer une séance</button>`;
    }
    const t = Store.templateById(progEdit);
    return `<div class="between mb6"><h1>${esc(t.name)}</h1><button class="btn ghost sm" data-action="prog-back">Séances</button></div>
    <div class="row mb12 gap8"><span class="ex-meta grow">${esc(t.focus || 'Sans focus')} · ~${Logic.estimateMinutes(t.blocks)} min</span>
      <button class="btn ghost sm" data-action="tpl-rename" data-id="${t.id}">Renommer</button></div>
    <div class="card">
      ${t.blocks.map((b, i) => { const ex = S().ex(b.exId); return `<div class="lib-item">
        <div style="display:flex;flex-direction:column;gap:2px">
          <button class="btn ghost sm" data-action="tpl-up" data-i="${i}" ${i === 0 ? 'disabled' : ''}>▲</button>
          <button class="btn ghost sm" data-action="tpl-down" data-i="${i}" ${i === t.blocks.length - 1 ? 'disabled' : ''}>▼</button>
        </div>
        <div class="grow0"><div class="ex-title fs14">${esc(ex ? ex.name : b.exId)}</div><div class="ex-meta">${ex ? esc(ex.musclePrimary) : ''}</div></div>
        <div class="row" style="gap:4px"><button class="btn ghost sm" data-action="tpl-sets-minus" data-i="${i}">−</button><span class="num" style="min-width:48px;text-align:center">${b.sets} séries</span><button class="btn ghost sm" data-action="tpl-sets-plus" data-i="${i}">+</button></div>
        <button class="btn ghost sm danger" data-action="tpl-remove" data-i="${i}">✕</button>
      </div>`; }).join('')}
    </div>
    <button class="btn primary block mt14" data-action="tpl-add">+ Ajouter un exercice</button>`;
  }

  // =====================================================================
  //  SHEETS (modales bas d'écran)
  // =====================================================================
  // Verrouille le défilement de la page derrière une couche modale.
  // Sur iOS, `overflow:hidden` ne suffit pas → on fige le body en position fixe.
  let lockedScrollY = 0, scrollLocked = false;
  function syncOverlayState() {
    const open = !!(document.getElementById('sheet') || document.getElementById('timer') || document.getElementById('onboard'));
    const appEl = app();
    if (appEl) appEl.setAttribute('aria-hidden', open ? 'true' : 'false');
    const tb = document.getElementById('tabbar'); if (tb) tb.setAttribute('aria-hidden', open ? 'true' : 'false');
    if (open && !scrollLocked) {
      lockedScrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${lockedScrollY}px`;
      document.body.style.left = '0'; document.body.style.right = '0';
      scrollLocked = true;
    } else if (!open && scrollLocked) {
      document.body.style.position = ''; document.body.style.top = '';
      document.body.style.left = ''; document.body.style.right = '';
      window.scrollTo(0, lockedScrollY);
      scrollLocked = false;
    }
  }

  function openSheet(html) {
    const swap = !!document.getElementById('sheet'); // une feuille en remplace une autre : fondu, pas de re-montée
    closeSheet(true);
    const bd = document.createElement('div');
    bd.className = 'sheet-backdrop' + (swap ? ' swap' : ''); bd.id = 'sheet';
    bd.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" tabindex="-1">
      <div class="sheet-head"><span class="grab-h"></span>
        <button class="sheet-close" data-action="close-sheet" aria-label="Fermer">✕</button></div>
      ${html}</div>`;
    bd.addEventListener('click', e => { if (e.target === bd) closeSheet(); });
    document.body.appendChild(bd);
    attachSwipeToClose(bd.querySelector('.sheet-head'), bd.querySelector('.sheet'));
    bd.firstElementChild.focus({ preventScroll: true }); // entre dans le dialogue sans ouvrir le clavier
    syncOverlayState();
  }
  function closeSheet(silent) {
    const s = document.getElementById('sheet');
    if (s) {
      if (silent || reducedMotion()) s.remove();
      else { s.removeAttribute('id'); s.classList.add('closing'); setTimeout(() => s.remove(), 220); } // sortie animée, l'id libéré tout de suite
    }
    if (!silent) syncOverlayState();
  }

  // Glisser la poignée vers le bas pour fermer (geste attendu sur mobile).
  function attachSwipeToClose(handle, sheet) {
    if (!handle || !sheet) return;
    let startY = null;
    handle.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; sheet.classList.add('dragging'); sheet.style.animation = 'none'; }, { passive: true });
    handle.addEventListener('touchmove', (e) => {
      if (startY == null) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0) sheet.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    handle.addEventListener('touchend', (e) => {
      if (startY == null) return;
      const dy = (e.changedTouches[0].clientY - startY);
      sheet.classList.remove('dragging');
      if (dy > 70) { // part de là où le doigt l'a lâchée
        const bd = sheet.parentElement; bd.removeAttribute('id'); bd.style.pointerEvents = 'none';
        sheet.style.transition = 'transform 200ms cubic-bezier(.5,0,.9,.4)'; sheet.style.transform = 'translateY(100%)';
        bd.style.transition = 'opacity 200ms ease'; bd.style.opacity = '0';
        setTimeout(() => bd.remove(), 210); syncOverlayState();
      } else sheet.style.transform = ''; // retour au ressort
      startY = null;
    });
  }

  // Petit message éphémère (remplace les alertes système, trop brutales en PWA).
  function toast(msg, kind) {
    const t = document.createElement('div');
    t.className = 'toast' + (kind ? ' ' + kind : ''); t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 2600);
  }

  // =====================================================================
  //  TIMER CHRONOGRAPHE (élément signature)
  // =====================================================================
  // Wake Lock : garde l'écran allumé pendant le repos (iOS 16.4+, Chrome…). Sans effet si non supporté.
  let wakeLock = null;
  async function requestWake() { try { if ('wakeLock' in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {} }
  function releaseWake() { try { if (wakeLock) { wakeLock.release(); wakeLock = null; } } catch (e) {} }

  // Validation d'une série : le ✓ est tamponné, la ligne se verrouille, le compteur avance.
  // Renvoie le centre du ✓ (origine de l'ouverture du chrono).
  function stampSet(b, si) {
    const btn = document.querySelector(`.set-check[data-b="${b}"][data-s="${si}"]`); if (!btn) return null;
    const r = btn.getBoundingClientRect();
    const origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    if (reducedMotion() || !btn.animate) return origin;
    const spring = 'cubic-bezier(.3,1.5,.5,1)';
    btn.animate([{ transform: 'scale(.55)' }, { transform: 'scale(1.18)', offset: .55 }, { transform: 'scale(1)' }], { duration: 340, easing: spring });
    const row = btn.closest('.set-row');
    if (row) row.querySelectorAll('input').forEach((inp, k) => inp.animate([{ transform: 'translateY(3px)', opacity: .35 }, { transform: 'none', opacity: 1 }], { duration: 260, delay: 40 * k, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
    const pips = document.querySelector(`.pips[data-pips="${b}"]`);
    if (pips) {
      const on = pips.querySelectorAll('i.on'); const last = on[on.length - 1];
      if (last) { last.style.transformOrigin = 'left'; last.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' }); }
      const cnt = pips.querySelector('.cnt'); if (cnt) cnt.animate([{ transform: 'translateY(6px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 240, easing: spring });
    }
    return origin;
  }

  // Le chrono est piloté par une échéance (endAt) et non par un compteur d'intervalles :
  // il reste juste même si l'app passe en arrière-plan. L'aiguille tourne en rAF (transform seul).
  const R = 140, CIRC = 2 * Math.PI * R;
  function startTimer(seconds, exId, origin, prLabel) {
    stopTimer(true);
    requestWake();
    const ex = S().ex(exId);
    const cue = ex && ex.elbowSensitive
      ? `<div class="timer-cue"><b>Coude sensible</b> — contrôle la trajectoire, garde le coude fixe, pas de verrouillage forcé en extension.</div>`
      : `<div class="timer-cue">Respire, prépare la prochaine série.</div>`;
    const ov = document.createElement('div');
    ov.className = 'timer-sheet'; ov.id = 'timer';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Minuteur de repos');
    if (origin) { ov.style.setProperty('--ox', origin.x + 'px'); ov.style.setProperty('--oy', origin.y + 'px'); }
    ov.innerHTML = `
      <div class="eyebrow">Repos${ex ? ' · ' + esc(ex.name) : ''}</div>
      ${prLabel ? `<div class="timer-pr" role="status"><b>Record</b>${esc(prLabel.replace(/^Record de /, ''))}</div>` : ''}
      <div class="dial" id="dial">
        <svg viewBox="0 0 320 320" aria-hidden="true">${dialTicks(160, 158, 146, 151)}
          <circle class="track" cx="160" cy="160" r="${R}"/>
          <circle class="prog" id="prog" cx="160" cy="160" r="${R}" stroke-dasharray="${CIRC}" stroke-dashoffset="0"/>
          <g class="needle" id="needle"><line x1="160" y1="34" x2="160" y2="6"/><circle cx="160" cy="20" r="5"/></g></svg>
        <div class="readout"><div class="t num" id="t-read">0:00</div><div class="lbl">repos restant</div></div>
      </div>
      ${cue}
      <div class="timer-controls">
        <button class="btn" data-action="timer-add">+30 s</button>
        <button class="btn" data-action="timer-skip">Passer</button>
      </div>
      ${ex ? `<button class="btn timer-save" data-action="timer-save-rest">Mémoriser ce repos pour ${esc(ex.name)}</button>` : ''}`;
    document.body.appendChild(ov);
    syncOverlayState();
    timer = { total: seconds, remaining: seconds, endAt: performance.now() + seconds * 1000, exId, shown: -1 };
    const tick = () => {
      if (!timer) return;
      const left = (timer.endAt - performance.now()) / 1000;
      if (left <= 0) { endTimer(); return; }
      timer.remaining = Math.ceil(left);
      paintTimer(left);
      timer.raf = requestAnimationFrame(tick);
    };
    tick();
    // rAF est suspendu en arrière-plan : un filet de sécurité déclenche la fin à l'heure.
    timer.interval = setInterval(() => { if (timer && performance.now() >= timer.endAt) endTimer(); }, 1000);
  }
  function paintTimer(left) {
    if (!timer) return;
    if (left == null) left = Math.max(0, (timer.endAt - performance.now()) / 1000);
    const frac = Math.max(0, Math.min(1, left / timer.total));
    const prog = document.getElementById('prog'); const needle = document.getElementById('needle');
    if (prog) prog.setAttribute('stroke-dashoffset', String(-CIRC * (1 - frac)));
    if (needle) needle.style.transform = `rotate(${((1 - frac) * 360).toFixed(2)}deg)`;
    if (timer.shown !== timer.remaining) { // le texte ne change qu'une fois par seconde
      timer.shown = timer.remaining;
      const m = Math.floor(timer.remaining / 60), s = timer.remaining % 60;
      const read = document.getElementById('t-read'); if (read) read.textContent = `${m}:${String(s).padStart(2, '0')}`;
      const dial = document.getElementById('dial'); if (dial) dial.classList.toggle('ending', timer.remaining <= 10);
    }
  }
  function endTimer() {
    beep();
    if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
    try { if (Notification && Notification.permission === 'granted') new Notification('Repos terminé', { body: 'Prochaine série.', tag: 'rest', silent: false }); } catch (e) {}
    stopTimer(false, 'done');
  }
  // how : 'done' (fin naturelle → flash puis retour) | 'out' (passé → fondu) ; instant = retrait sec.
  function stopTimer(instant, how) {
    if (timer) { clearInterval(timer.interval); cancelAnimationFrame(timer.raf); }
    timer = null; if (route !== 'session') releaseWake();
    const t = document.getElementById('timer');
    if (t) {
      if (instant === true || reducedMotion()) t.remove();
      else { t.removeAttribute('id'); t.classList.add(how || 'out'); setTimeout(() => t.remove(), how === 'done' ? 580 : 220); }
    }
    syncOverlayState();
  }

  // =====================================================================
  //  DRAFT (démarrer / manipuler une séance)
  // =====================================================================
  function buildDraft(template, budget) {
    let blocks = Logic.activeBlocks(template);
    let dropped = [];
    if (budget && budget < 60) { const r = Logic.recompose(blocks, budget); blocks = r.blocks; dropped = r.dropped; }
    const draftBlocks = blocks.map(b => {
      const ex = S().ex(b.exId);
      const prog = Logic.progression(b.exId);
      const last = Logic.lastOccurrence(b.exId);
      const guessW = prog && prog.type === 'load' ? prog.to : (prog && prog.weight) || (last ? Math.max(...last.entry.sets.map(s => s.weight || 0)) : null);
      const sets = Array.from({ length: b.sets }, () => ({ weight: guessW ?? '', reps: '', rir: '', done: false, type: 'normal' }));
      return { exId: b.exId, sets, substitutedFrom: null, superset: false, note: '' };
    });
    return {
      templateId: template.id, name: template.name, code: template.code, focus: template.focus, note: template.note || '',
      startedAt: new Date().toISOString(), timeBudget: budget || 60, dropped,
      blocks: draftBlocks,
      cardio: { ...S().settings.cardioDefault, enabled: true, done: false },
      checkin: null,
    };
  }

  async function finishSession() {
    const d = S().draft;
    const entries = d.blocks
      .map(b => {
        const ex = S().ex(b.exId);
        const sets = b.sets.map(s => ({ weight: num(s.weight), reps: num(s.reps), rir: num(s.rir), done: !!s.done, type: s.type || 'normal' }));
        if (!sets.some(s => s.done)) return null;
        const prs = Logic.prForEntry(b.exId, sets, d.startedAt);
        return { exId: b.exId, resolvedName: ex ? ex.name : b.exId, musclePrimary: ex ? ex.musclePrimary : '', role: ex ? ex.role : 'isolation', substitutedFrom: b.substitutedFrom, sets, prs, note: b.note || '' };
      })
      .filter(Boolean);

    // 1) Récap de fin → 2) check-in → 3) persistance
    const recap = computeRecap(d, entries);
    sessionNote = '';
    openRecap(recap, async () => {
      const session = {
        id: Date.now(), date: new Date().toISOString(), templateId: d.templateId, name: d.name, code: d.code,
        entries, cardio: d.cardio.done ? d.cardio : null, checkin: null, timeBudget: d.timeBudget, note: sessionNote || '',
      };
      await Store.saveSession(session);
      S().sessions.push(session);
      await Store.advanceRotation(d.templateId);
      await Store.clearDraft();
      go('home');
      // Le ressenti est un complément : fermer cette feuille ne perd plus la séance.
      openCheckin(async (checkin) => {
        if (checkin) { session.checkin = checkin; await Store.saveSession(session); }
        closeSheet(); render();
      });
    });
  }

  function computeRecap(d, entries) {
    let volume = 0, workingSets = 0;
    const muscles = {};
    for (const e of entries) for (const s of e.sets) {
      if (!s.done || s.type === 'warm') continue;
      volume += (s.weight || 0) * (s.reps || 0);
      workingSets++;
      muscles[e.musclePrimary] = (muscles[e.musclePrimary] || 0) + 1;
    }
    const prs = entries.flatMap(e => (e.prs || []).map(p => ({ name: e.resolvedName, label: p.label })));
    const duration = Math.max(1, Math.round((Date.now() - new Date(d.startedAt).getTime()) / 60000));
    return { name: d.name, volume: Math.round(volume), volumeT: (volume / 1000), workingSets, muscles, prs, duration, cardio: d.cardio.done ? d.cardio : null };
  }

  function openRecap(r, onContinue) {
    const muscleChips = Object.entries(r.muscles).sort((a, b) => b[1] - a[1])
      .map(([m, n]) => `<span class="chip ok fs11">${esc(m)} ${n}</span>`).join(' ');
    openSheet(`<div class="grab"></div>
      <div class="view">
      <div class="eyebrow">Séance terminée</div>
      <h2 class="mt4 mb14">${esc(r.name)}, bouclé.</h2>
      <div class="recap-kpis">
        <div class="recap-kpi"><div class="v num"><span data-count="${r.volumeT >= 1 ? r.volumeT.toFixed(1) : r.volume}" data-dec="${r.volumeT >= 1 ? 1 : 0}">0</span><span class="u">${r.volumeT >= 1 ? ' t' : ' kg'}</span></div><div class="k">Volume travaillé</div></div>
        <div class="recap-kpi"><div class="v num"><span data-count="${r.duration}">0</span><span class="u"> min</span></div><div class="k">Durée réelle</div></div>
        <div class="recap-kpi"><div class="v num"><span data-count="${r.workingSets}">0</span></div><div class="k">Séries de travail</div></div>
      </div>
      ${r.prs.length ? `<div class="banner volt mt12"><div><div class="ttl">${r.prs.length} record${r.prs.length > 1 ? 's' : ''} battu${r.prs.length > 1 ? 's' : ''}</div>${r.prs.map(p => `<div class="body">${esc(p.name)} · ${esc(p.label)}</div>`).join('')}</div></div>` : ''}
      ${muscleChips ? `<div class="card pad mt12"><div class="eyebrow mb8">Muscles touchés</div><div class="wrap">${muscleChips}</div></div>` : ''}
      ${r.cardio ? `<div class="ex-meta mt10">Finisher · marche ${r.cardio.duration} min · ${r.cardio.incline}% · ${r.cardio.speed} km/h</div>` : ''}
      <label class="field mt14"><span>Note de séance (optionnel)</span><textarea id="recap-note" rows="2" placeholder="Sensations, douleurs, énergie…"></textarea></label>
      <button class="btn primary block mt14" data-action="recap-continue">Enregistrer la séance</button>
      </div>`);
    recapContinue = onContinue;
    countUp(document.getElementById('sheet'));
  }
  // Les KPIs comptent jusqu'à leur valeur (une fois, à l'ouverture du récap).
  function countUp(root) {
    if (!root) return;
    root.querySelectorAll('[data-count]').forEach((el, k) => {
      const to = parseFloat(el.dataset.count) || 0, dec = +el.dataset.dec || 0;
      const fmt = (v) => dec ? v.toFixed(dec) : String(Math.round(v));
      if (reducedMotion()) { el.textContent = fmt(to); return; }
      const t0 = performance.now() + 180 + k * 110, dur = 700;
      const step = (now) => {
        if (!el.isConnected) return;
        const p = Math.max(0, Math.min(1, (now - t0) / dur)), e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(to * e);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
  let recapContinue = null;
  let sessionNote = '';

  function openCheckin(cb) {
    const opt = (field, val, label) => `<button class="btn block" data-ck="${field}" data-v="${val}">${label}</button>`;
    let state = { energy: null, sleep: null };
    openSheet(`<div class="grab"></div>
      <h2>Séance enregistrée</h2>
      <p class="muted lead">Deux taps de plus : comment tu te sens ? Ça pilote les suggestions de repli, sans jugement.</p>
      <div class="eyebrow">Énergie</div>
      <div class="row mt8 mb14" id="ck-energy">${opt('energy', 1, 'Basse')}${opt('energy', 2, 'Correcte')}${opt('energy', 3, 'Top')}</div>
      <div class="eyebrow">Sommeil</div>
      <div class="row mt8 mb14" id="ck-sleep">${opt('sleep', 1, 'Court')}${opt('sleep', 2, 'Correct')}${opt('sleep', 3, 'Excellent')}</div>
      <button class="btn primary block" id="ck-done" disabled>Enregistrer le ressenti</button>
      <button class="btn ghost block mt8" id="ck-skip">Passer</button>`);
    const sheet = document.getElementById('sheet');
    sheet.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ck]');
      if (b) {
        const f = b.dataset.ck; state[f] = +b.dataset.v;
        sheet.querySelectorAll(`#ck-${f} .btn`).forEach(x => x.classList.remove('primary'));
        b.classList.add('primary');
        sheet.querySelector('#ck-done').disabled = !(state.energy && state.sleep);
      }
      if (e.target.id === 'ck-done') cb(state);
      if (e.target.id === 'ck-skip') cb(null);
    });
  }

  const num = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };

  // =====================================================================
  //  EXPORT / IMPORT
  // =====================================================================
  async function doExport() {
    const data = {
      _app: 'chronographe', _version: 1, exportedAt: new Date().toISOString(),
      exercises: S().exercises, sessions: S().sessions, settings: S().settings,
      programs: S().programs, body: S().body || [],
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `chronographe-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function doImport() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json';
    inp.onchange = () => {
      const f = inp.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = async () => {
        try {
          const d = JSON.parse(r.result);
          if (d._app !== 'chronographe') throw new Error('format');
          for (const e of d.exercises) await Store.saveExercise(e);
          for (const s of d.sessions) await Store.saveSession(s);
          for (const bx of (d.body || [])) await Store.saveBody(bx);
          S().settings = d.settings; await Store.saveSettings();
          if (d.programs) S().programs = d.programs;
          else { S().programs = S().programs || {}; if (d.program6) S().programs['ppl6'] = d.program6; if (d.program4) S().programs['ul4'] = d.program4; }
          await Store.saveProgram();
          location.reload();
        } catch (err) { toast('Fichier invalide — ce n’est pas une sauvegarde Chronographe.'); }
      };
      r.readAsText(f);
    };
    inp.click();
  }

  // =====================================================================
  //  GESTIONNAIRE D'ÉVÉNEMENTS (délégation)
  // =====================================================================
  async function onClick(e) {
    const nav = e.target.closest('[data-nav]'); if (nav) { if (nav.dataset.nav === 'program') { progEdit = null; pendingProgram = null; } go(nav.dataset.nav); return; }
    const el = e.target.closest('[data-action]'); if (!el) return;
    const a = el.dataset.action;
    const d = S().draft;

    switch (a) {
      case 'close-sheet': closeSheet(); break;
      case 'theme': { try { localStorage.setItem('chrono-theme', el.dataset.v); } catch (err) {} if (window.applyTheme) window.applyTheme(); render(); break; }

      // ---- démarrage séance : sélecteur de temps ----
      case 'start-picker': {
        const t = Store.todayTemplate();
        openSheet(`<div class="grab"></div><h2>${esc(t.name)}</h2>
          <p class="muted lead">Combien de temps as-tu aujourd’hui ? Sous 60 min, je garde les compounds et coupe les isolations secondaires.</p>
          <div class="stack">
            <button class="btn primary block" data-action="start" data-budget="60">60 min · séance complète</button>
            <button class="btn block" data-action="start" data-budget="40">40 min · resserrée</button>
            <button class="btn block" data-action="start" data-budget="25">25 min · l’essentiel</button>
          </div>`);
        break;
      }
      case 'start': {
        const t = Store.todayTemplate();
        S().draft = buildDraft(t, +el.dataset.budget);
        await Store.saveDraft(); closeSheet(); go('session');
        break;
      }
      case 'reorder': {
        const up = Store.upcoming(6);
        openSheet(`<div class="grab"></div><h2>Changer la séance du jour</h2>
          <p class="muted lead">Touche une séance pour la voir en entier, puis mets-la à aujourd’hui. La séance prévue se décale d’un cran.</p>
          <div class="card">${Store.currentOrder().map(t => `<div class="lib-item prog-row" data-action="preview-session" data-id="${esc(t.id)}"><div class="grow0"><div class="ex-title fs15">${esc(t.name)}</div><div class="ex-meta">${esc(t.focus)} · ~${Logic.estimateMinutes(Logic.activeBlocks(t))} min</div></div><span class="badge-eq">Aperçu</span></div>`).join('')}</div>`);
        break;
      }

      case 'abort': openSheet(`<div class="grab"></div><h2>Quitter la séance ?</h2><p class="muted lead">Ta progression n’est pas encore enregistrée. Tu peux reprendre plus tard depuis l’accueil, ou tout effacer.</p><button class="btn block" data-action="close-sheet">Reprendre plus tard</button><button class="btn danger block mt8" data-action="abort-confirm">Abandonner la séance</button>`); break;
      case 'abort-confirm': await Store.clearDraft(); closeSheet(); go('home'); break;

      // ---- log de série ----
      case 'toggle-set': {
        const b = +el.dataset.b, s = +el.dataset.s; const set = d.blocks[b].sets[s];
        set.done = !set.done;
        if (set.done) {
          const blk = d.blocks[b]; const ex = S().ex(blk.exId);
          const last = Logic.lastOccurrence(blk.exId);
          // Charge vide sur un exercice chargé : on reprend celle de la dernière fois (affichée en
          // filigrane) ; sans référence, on ne valide pas — une série à 0 kg fausse volume et records.
          if ((set.weight == null || set.weight === '') && ex.equipment !== 'poids du corps') {
            const prev = last && last.entry.sets[s] && last.entry.sets[s].weight;
            if (prev) set.weight = prev;
            else {
              set.done = false;
              const inp = document.querySelector(`input[data-b="${b}"][data-s="${s}"][data-f="weight"]`);
              if (inp) { if (inp.animate && !reducedMotion()) inp.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 300 }); inp.focus(); }
              toast('Indique la charge avant de valider.'); return;
            }
          }
          if (set.reps == null || set.reps === '') set.reps = ex.repMin;
          const rest = Logic.restFor(ex);
          armSound();
          // Record battu ? Annoncé à l'instant de la série, une seule fois par palier.
          let prLabel = null;
          if (last && set.type !== 'warm') {
            const norm = blk.sets.map(x => ({ weight: num(x.weight), reps: num(x.reps), done: !!x.done, type: x.type || 'normal' }));
            blk.prSeen = blk.prSeen || {};
            for (const pr of Logic.prForEntry(blk.exId, norm, d.startedAt)) {
              if (!(pr.value > (blk.prSeen[pr.kind] || 0))) continue;
              blk.prSeen[pr.kind] = pr.value; prLabel = prLabel || pr.label;
            }
          }
          await Store.saveDraft(); render();
          const origin = stampSet(b, s);
          const allDone = d.blocks.every(bl => bl.sets.every(x => x.done));
          // Pas de repos après un échauffement ni après la toute dernière série.
          if (set.type === 'warm' || allDone) {
            if (prLabel) toast(prLabel, 'pr');
            else if (allDone) toast('Dernière série validée. Tu peux terminer la séance.');
            return;
          }
          startTimer(blk.superset ? Math.round(rest * 0.6) : rest, ex.id, origin, prLabel);
          return;
        }
        await Store.saveDraft(); render(); break;
      }
      case 'add-set': { const b = +el.dataset.b; const last = d.blocks[b].sets[d.blocks[b].sets.length - 1]; d.blocks[b].sets.push({ weight: last ? last.weight : '', reps: '', rir: '', done: false, type: 'normal' }); await Store.saveDraft(); render(); break; }
      case 'del-set': { const b = +el.dataset.b; if (d.blocks[b].sets.length > 1) d.blocks[b].sets.pop(); await Store.saveDraft(); render(); break; }
      case 'superset': { const b = +el.dataset.b; d.blocks[b].superset = !d.blocks[b].superset; await Store.saveDraft(); render(); break; }
      case 'move-ex': {
        const b = +el.dataset.b, j = b + (+el.dataset.dir);
        if (j < 0 || j >= d.blocks.length) break;
        [d.blocks[b], d.blocks[j]] = [d.blocks[j], d.blocks[b]];
        await Store.saveDraft(); render(); break;
      }
      case 'ex-note': {
        const b = +el.dataset.b; const ex = S().ex(d.blocks[b].exId);
        openSheet(`<div class="grab"></div><h2>Note · ${esc(ex.name)}</h2>
          <p class="muted lead">Ressenti, réglage de la machine, douleur, rappel technique…</p>
          <textarea id="exnote" rows="4">${esc(d.blocks[b].note || '')}</textarea>
          <button class="btn primary block mt12" data-action="ex-note-save" data-b="${b}">Enregistrer la note</button>`);
        break;
      }
      case 'ex-note-save': { const b = +el.dataset.b; d.blocks[b].note = document.getElementById('exnote').value.trim(); await Store.saveDraft(); closeSheet(); render(); break; }

      // ---- types de séries ----
      case 'cycle-type': {
        const b = +el.dataset.b, s = +el.dataset.s; const order = ['normal', 'warm', 'drop', 'fail', 'amrap'];
        const set = d.blocks[b].sets[s]; set.type = order[(order.indexOf(set.type || 'normal') + 1) % order.length];
        await Store.saveDraft(); render(); break;
      }
      case 'warmup': {
        const b = +el.dataset.b; const blk = d.blocks[b]; const ex = S().ex(blk.exId);
        const firstWork = blk.sets.find(s => (s.type || 'normal') !== 'warm');
        const w = num(firstWork && firstWork.weight);
        const warm = Logic.warmupSets(w, ex.equipment);
        if (!warm.length) { openSheet('<div class="grab"></div><div class="empty"><div class="big">Charge de travail manquante</div>Renseigne d’abord le poids de ta première série pour générer l’échauffement.</div><button class="btn primary block" data-action="close-sheet">OK</button>'); break; }
        blk.sets = warm.concat(blk.sets); await Store.saveDraft(); render(); break;
      }
      case 'plates': {
        const b = +el.dataset.b; const blk = d.blocks[b]; const ex = S().ex(blk.exId);
        const firstWork = blk.sets.find(s => (s.type || 'normal') !== 'warm') || blk.sets[0];
        openPlateSheet(num(firstWork && firstWork.weight) || 0, ex); break;
      }
      case 'recap-continue': {
        const nEl = document.getElementById('recap-note'); sessionNote = nEl ? nEl.value.trim() : '';
        closeSheet(); if (recapContinue) { const f = recapContinue; recapContinue = null; f(); } break;
      }
      case 'session-detail': openSessionDetail(+el.dataset.id); break;
      case 'session-delete': {
        const id = +el.dataset.id;
        await Store.deleteSession(id);
        S().sessions = S().sessions.filter(s => s.id !== id);
        closeSheet(); render(); break;
      }
      case 'ex-progress': openExProgress(el.dataset.id); break;
      case 'lib-tab': { const order = ['prog', 'seances', 'exos']; enterDir = Math.sign(order.indexOf(el.dataset.tab) - order.indexOf(libTab)); libTab = el.dataset.tab; render(true, true); window.scrollTo(0, 0); break; }
      case 'preview-session': openSessionPreview(el.dataset.id); break;
      case 'bump': case 'do-session': { await Store.bumpToFront(el.dataset.id); closeSheet(); go('home'); break; }
      case 'one-rm': openOneRM('', '', 'barre'); break;
      case 'one-rm-ex': { const ser = Logic.e1rmSeries(el.dataset.id); const top = ser.length ? ser[ser.length - 1].top : {}; const ex = S().ex(el.dataset.id); openOneRM(top.weight ?? '', top.reps ?? '', ex ? ex.equipment : 'barre'); break; }

      // ---- onboarding ----
      case 'onb-next': onb.step++; showOnboard(); break;
      case 'onb-back': onb.step--; showOnboard(); break;
      case 'onb-skip': { S().settings.onboarded = true; await Store.saveSettings(); onb = null; closeOnboard(); go('home'); break; }
      case 'onb-goal': onb.goal = el.dataset.v; showOnboard(); break;
      case 'onb-exp': onb.experience = el.dataset.v; showOnboard(); break;
      case 'onb-mode': onb.mode = +el.dataset.v; showOnboard(); break;
      case 'onb-day': { const dd = +el.dataset.d; const i = onb.planDays.indexOf(dd); if (i >= 0) onb.planDays.splice(i, 1); else onb.planDays.push(dd); showOnboard(); break; }
      case 'onb-finish': await finishOnboarding(); break;

      // ---- suivi corporel ----
      case 'body-add': openBodySheet(); break;
      case 'body-save': await saveBodyForm(); break;

      // ---- plans "si-alors" ----
      case 'add-plan': openPlanSheet(); break;
      case 'plan-day-toggle': el.classList.toggle('on'); break;
      case 'plan-create': {
        const sheet = document.getElementById('sheet');
        const days = [...sheet.querySelectorAll('.day-chip.on')].map(x => +x.dataset.d);
        if (!days.length) { sheet.querySelector('#plan-days').classList.add('shake'); break; }
        const time = sheet.querySelector('#plan-time').value || '18:00';
        const anchor = sheet.querySelector('#plan-anchor').value.trim();
        const plans = S().settings.plans || (S().settings.plans = []);
        days.forEach(dd => plans.push({ id: 'p' + dd + '_' + Date.now() + Math.random().toString(36).slice(2, 5), day: dd, time, anchor }));
        await Store.saveSettings(); scheduleReminder(); closeSheet(); render(); break;
      }
      case 'plan-remove': { S().settings.plans = (S().settings.plans || []).filter(p => p.id !== el.dataset.id); await Store.saveSettings(); scheduleReminder(); render(); break; }

      // ---- substitution ----
      case 'substitute': {
        const b = +el.dataset.b; const cur = S().ex(d.blocks[b].exId);
        const alts = Logic.substitutes(d.blocks[b].exId);
        openSheet(`<div class="grab"></div><h2>Remplacer ${esc(cur.name)}</h2>
          <p class="muted lead">Même muscle (${esc(cur.musclePrimary)}), mouvement proche, autre matériel${cur.elbowSensitive ? ', coude-safe' : ''}.</p>
          ${alts.length ? alts.map(x => `<div class="sub-alt">${ILLU.svgFor(x.pattern, x.musclePrimary)}<div class="grow"><div class="ex-title fs14">${esc(x.name)}</div><div class="ex-meta">${esc(x.equipment)} · ${esc(x.musclePrimary)}</div></div><div style="display:flex;flex-direction:column;gap:6px"><button class="btn sm primary" data-action="sub-once" data-b="${b}" data-id="${x.id}">Cette séance</button><button class="btn sm steel" data-action="sub-perm" data-b="${b}" data-id="${x.id}">Définitif</button></div></div>`).join('') : '<div class="empty">Aucune alternative pertinente trouvée dans la bibliothèque.</div>'}`);
        break;
      }
      case 'sub-once': { const b = +el.dataset.b; const from = d.blocks[b].exId; d.blocks[b].substitutedFrom = from; d.blocks[b].exId = el.dataset.id; await Store.saveDraft(); closeSheet(); render(); break; }
      case 'sub-perm': {
        const b = +el.dataset.b; const from = d.blocks[b].exId; const to = el.dataset.id;
        d.blocks[b].substitutedFrom = from; d.blocks[b].exId = to;
        // propage aux prochaines occurrences dans le template du programme actif
        const t = Store.currentOrder().find(x => x.id === d.templateId);
        if (t) { const blk = t.blocks.find(x => x.exId === from); if (blk) blk.exId = to; await Store.saveProgram(); }
        await Store.saveDraft(); closeSheet(); render(); break;
      }

      // ---- cardio finisher ----
      case 'toggle-cardio': d.cardio.done = !d.cardio.done; await Store.saveDraft(); render(); break;

      // ---- finir ----
      case 'finish': {
        if (!d.blocks.some(b => b.sets.some(s => s.done))) { openSheet('<div class="grab"></div><div class="empty"><div class="big">Aucune série validée</div>Valide au moins une série avant de terminer.</div><button class="btn primary block" data-action="close-sheet">OK</button>'); break; }
        await finishSession(); break;
      }

      // ---- timer ----
      case 'timer-add': if (timer) { timer.endAt += 30000; timer.remaining += 30; timer.total += 30; paintTimer(); } break;
      case 'timer-skip': stopTimer(); break;
      case 'timer-save-rest': {
        if (!timer || !timer.exId) break;
        const ex = S().ex(timer.exId); if (!ex) break;
        ex.restSec = timer.total; await Store.saveExercise(ex);
        toast(`Repos de ${Math.floor(timer.total / 60)}:${String(timer.total % 60).padStart(2, '0')} mémorisé pour ${ex.name}.`);
        break;
      }

      // ---- banners ----
      case 'apply-deload': {
        const dl = S().settings.deload; dl.active = true; dl.activeUntil = new Date(Date.now() + 7 * 864e5).toISOString(); dl.lastDeloadDate = new Date().toISOString(); dl.snoozeUntil = null;
        await Store.saveSettings(); go(route === 'more' ? 'more' : 'home'); break;
      }
      case 'dismiss-deload': { S().settings.deload.snoozeUntil = new Date(Date.now() + 7 * 864e5).toISOString(); await Store.saveSettings(); go('home'); break; }
      case 'to-4day': await Store.setMode(4); go('home'); break;
      case 'dismiss-fatigue': { // marquer les check-ins vus pour ne plus proposer immédiatement
        S().sessions.filter(s => s.checkin).slice(-2).forEach(s => s.checkin._seen = true);
        for (const s of S().sessions.slice(-2)) await Store.saveSession(s); go('home'); break; }

      // ---- bibliothèque ----
      case 'new-exercise': openSheet(exerciseForm(null)); break;
      case 'edit-exercise': openSheet(exerciseForm(S().ex(el.dataset.id))); break;
      case 'sound': break; // géré dans onChange
      case 'pattern-change': break; // géré dans onChange
      case 'save-exercise': await saveExerciseForm(el.dataset.id); break;
      case 'archive-exercise': { const ex = S().ex(el.dataset.id); ex.archived = !ex.archived; await Store.saveExercise(ex); closeSheet(); render(); break; }

      // ---- mode / réglages ----
      case 'mode': await Store.setMode(+el.dataset.mode); render(); break;
      case 'set-program': {
        const r = await Store.setProgram(el.dataset.id);
        if (r === 'empty') { toast('Ajoute au moins une séance à ce programme avant de l’activer.'); break; }
        closeSheet(); render(); break;
      }
      case 'prog-create': {
        openSheet(`<h2>Créer mon programme</h2>
          <p class="muted lead">Tu y ajouteras ensuite tes séances, avec les exercices de ton choix.</p>
          <label class="field"><span>Nom du programme</span><input id="np-name" placeholder="ex. Mon split maison"></label>
          <button class="btn primary block mt14" data-action="prog-create-do">Créer</button>`);
        break;
      }
      case 'prog-create-do': {
        const name = (document.getElementById('np-name').value || '').trim();
        const id = await Store.createProgram(name || 'Mon programme');
        closeSheet(); progEdit = null; pendingProgram = id; go('program');
        toast('Programme créé — ajoute ta première séance.'); break;
      }
      case 'prog-edit': { pendingProgram = el.dataset.id; progEdit = null; go('program'); break; }
      case 'prog-delete': {
        const id = el.dataset.id;
        openSheet(`<h2>Supprimer ce programme ?</h2><p class="muted lead">Ses séances seront perdues. Ton historique d’entraînement, lui, reste intact.</p>
          <button class="btn block" data-action="close-sheet">Annuler</button>
          <button class="btn danger block mt8" data-action="prog-delete-do" data-id="${esc(id)}">Supprimer</button>`);
        break;
      }
      case 'prog-delete-do': { await Store.deleteProgram(el.dataset.id); closeSheet(); go('train'); toast('Programme supprimé.'); break; }
      case 'tpl-new': {
        openSheet(`<h2>Nouvelle séance</h2>
          <label class="field"><span>Nom</span><input id="nt-name" placeholder="ex. Haut du corps A"></label>
          <label class="field mt10"><span>Type d’entraînement</span><select id="nt-code">${Object.keys(CODE_LABEL).map(c => `<option value="${c}">${esc(CODE_LABEL[c])}</option>`).join('')}<option value="PERSO">Séance personnalisée</option></select></label>
          <label class="field mt10"><span>Focus (optionnel)</span><input id="nt-focus" placeholder="ex. Pecs · dos"></label>
          <button class="btn primary block mt14" data-action="tpl-new-do">Créer la séance</button>`);
        break;
      }
      case 'tpl-new-do': {
        const pid = pendingProgram || S().settings.programId;
        const id = await Store.addTemplate(pid, { name: (document.getElementById('nt-name').value || '').trim() || 'Nouvelle séance',
          code: document.getElementById('nt-code').value, focus: (document.getElementById('nt-focus').value || '').trim() });
        closeSheet(); progEdit = id; render(); toast('Séance créée — ajoute tes exercices.'); break;
      }
      case 'tpl-dup': { await Store.duplicateTemplate(pendingProgram || S().settings.programId, el.dataset.id); render(); toast('Séance dupliquée.'); break; }
      case 'tpl-del': {
        const id = el.dataset.id;
        openSheet(`<h2>Supprimer cette séance ?</h2><p class="muted lead">Elle disparaît du programme. Les séances déjà loggées restent dans ton historique.</p>
          <button class="btn block" data-action="close-sheet">Annuler</button>
          <button class="btn danger block mt8" data-action="tpl-del-do" data-id="${esc(id)}">Supprimer</button>`);
        break;
      }
      case 'tpl-del-do': { await Store.removeTemplate(pendingProgram || S().settings.programId, el.dataset.id); closeSheet(); progEdit = null; render(); break; }
      case 'tpl-rename': {
        const t = Store.templateById(el.dataset.id);
        openSheet(`<h2>Renommer</h2>
          <label class="field"><span>Nom</span><input id="rt-name" value="${esc(t.name)}"></label>
          <label class="field mt10"><span>Focus</span><input id="rt-focus" value="${esc(t.focus || '')}"></label>
          <button class="btn primary block mt14" data-action="tpl-rename-do" data-id="${esc(t.id)}">Enregistrer</button>`);
        break;
      }
      case 'tpl-rename-do': {
        const t = Store.templateById(el.dataset.id);
        t.name = (document.getElementById('rt-name').value || '').trim() || t.name;
        t.focus = (document.getElementById('rt-focus').value || '').trim();
        await Store.saveProgram(); closeSheet(); render(); break;
      }
      case 'prog-detail': openProgramDetail(el.dataset.id); break;
      case 'enable-reminder': await enableReminder(); break;
      case 'export': await doExport(); break;
      case 'import': doImport(); break;
      case 'check-updates': await checkUpdates(); break;
      case 'reset': openSheet('<div class="grab"></div><h2>Réinitialiser ?</h2><p class="muted lead">Tout l’historique, le programme et les réglages seront effacés. Pense à exporter avant.</p><button class="btn block" data-action="close-sheet">Annuler</button><button class="btn danger block mt8" data-action="reset-confirm">Tout effacer</button>'); break;
      case 'reset-confirm': { indexedDB.deleteDatabase('chrono-musculation'); location.reload(); break; }

      // ---- éditeur programme ----
      case 'edit-template': progEdit = el.dataset.id; render(); break;
      case 'prog-back': progEdit = null; render(); break;
      case 'tpl-up': case 'tpl-down': { const t = Store.templateById(progEdit); const i = +el.dataset.i; const j = a === 'tpl-up' ? i - 1 : i + 1; [t.blocks[i], t.blocks[j]] = [t.blocks[j], t.blocks[i]]; await Store.saveProgram(); render(); break; }
      case 'tpl-sets-plus': { const t = Store.templateById(progEdit); t.blocks[+el.dataset.i].sets++; await Store.saveProgram(); render(); break; }
      case 'tpl-sets-minus': { const t = Store.templateById(progEdit); const b = t.blocks[+el.dataset.i]; if (b.sets > 1) b.sets--; await Store.saveProgram(); render(); break; }
      case 'tpl-remove': { const t = Store.templateById(progEdit); t.blocks.splice(+el.dataset.i, 1); await Store.saveProgram(); render(); break; }
      case 'tpl-add': {
        lastPickQuery = '';
        const t = Store.templateById(progEdit);
        openSheet(`<h2>Ajouter à ${esc(t.name)}</h2>
          <input id="pick-q" placeholder="Rechercher un exercice ou un muscle…" data-action="pick-search" class="mt12">
          <div id="pick-list" class="mt10">${pickList('')}</div>`);
        break;
      }
      case 'tpl-add-do': { const t = Store.templateById(progEdit); t.blocks.push({ exId: el.dataset.id, sets: 3 }); await Store.saveProgram(); closeSheet(); render(); break; }
    }
  }

  // inputs / selects / ranges
  async function onChange(e) {
    const t = e.target; const d = S().draft;
    if (t.dataset.b != null && t.dataset.f) { // sets de séance
      d.blocks[+t.dataset.b].sets[+t.dataset.s][t.dataset.f] = t.value; await Store.saveDraft(); return;
    }
    if (t.dataset.action === 'pattern-change' || t.id === 'f-muscle') {
      const p = document.getElementById('f-pattern').value, m = document.getElementById('f-muscle').value;
      const box = document.getElementById('form-illu'); if (box) box.innerHTML = ILLU.svgFor(p, m); return;
    }
    switch (t.dataset.action) {
      case 'lib-search': if (t.value === libFilter) break; libFilter = t.value; { const cur = document.activeElement; render(); const ni = app().querySelector('[data-action="lib-search"]'); if (ni) { ni.focus(); ni.setSelectionRange(ni.value.length, ni.value.length); } } break;
      case 'cardio-dur': d.cardio.duration = +t.value; document.getElementById('cardio-dur-val').textContent = t.value; await Store.saveDraft(); break;
      case 'sound': try { localStorage.setItem('chrono-sound', t.checked ? 'on' : 'off'); } catch (err) {} if (t.checked) { armSound(); beep(); } break;
      case 'cardio-incline': d.cardio.incline = +t.value; await Store.saveDraft(); break;
      case 'cardio-speed': d.cardio.speed = +t.value; await Store.saveDraft(); break;
      case 'increment': S().settings.increments[t.dataset.k] = +t.value || 1; await Store.saveSettings(); break;
      case 'rest': S().settings.restByRole[t.dataset.k] = +t.value || 60; await Store.saveSettings(); break;
      case 'reminder-time': S().settings.reminderTime = t.value; await Store.saveSettings(); break;
      case 'onb-inc': if (onb) onb.increments[t.dataset.k] = +t.value || 1; break;
      case 'onb-weight': if (onb) onb.weight = t.value; break;
      case 'onb-time': if (onb) onb.planTime = t.value; break;
      case 'barweight': S().settings.barWeight = +t.value || 20; await Store.saveSettings(); break;
      case 'plates-setting': S().settings.plates = t.value.split(',').map(x => parseFloat(x.trim())).filter(x => x > 0).sort((a, b) => b - a); await Store.saveSettings(); break;
      case 'plate-target': { const out = document.getElementById('plate-out'); if (out) out.innerHTML = plateHTML(t.value); break; }
      case 'pick-search': {
        if (t.value === lastPickQuery) break; // évite de détruire l'élément qu'on est en train de toucher
        lastPickQuery = t.value;
        const out = document.getElementById('pick-list'); if (out) out.innerHTML = pickList(t.value);
        break;
      }
      case 'orm': { const out = document.getElementById('orm-out'); if (out) out.innerHTML = ormTable(document.getElementById('orm-w').value, document.getElementById('orm-r').value, document.getElementById('orm-eq').value); break; }
    }
  }

  async function saveExerciseForm(id) {
    const g = (x) => document.getElementById(x);
    const name = g('f-name').value.trim(); if (!name) { g('f-name').focus(); return; }
    const existing = id ? S().ex(id) : null;
    const ex = existing || { id: 'cust_' + Date.now(), custom: true, archived: false };
    ex.name = name;
    ex.musclePrimary = g('f-muscle').value;
    ex.equipment = g('f-equip').value;
    ex.pattern = g('f-pattern').value;
    ex.repMin = +g('f-repmin').value || 8;
    ex.repMax = +g('f-repmax').value || ex.repMin;
    ex.role = g('f-role').value;
    { const r = parseInt(g('f-rest').value, 10); ex.restSec = (r > 0 ? r : null); }
    ex.biomech = g('f-bio').value.trim();
    ex.tips = g('f-tips').value.split('\n').map(s => s.trim()).filter(Boolean);
    ex.elbowSensitive = g('f-elbow').checked;
    ex.elbowUnsafe = g('f-unsafe').checked;
    ex.muscleSecondary = ex.muscleSecondary || [];
    await Store.saveExercise(ex);
    if (!existing) S().exercises.push(ex);
    closeSheet(); render();
  }

  // ---- mises à jour ----
  async function checkUpdates() {
    if (!('serviceWorker' in navigator)) { location.reload(); return; }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update();
        if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING'); // active tout de suite → recharge auto
      }
      // si une mise à jour existe, controllerchange recharge la page ; sinon on rassure.
      setTimeout(() => { if (!window.__reloading) toast('Tu es déjà à jour ✓ · version ' + (window.APP_VERSION || '')); }, 2500);
    } catch (e) { location.reload(); }
  }

  // ---- notifications ----
  async function enableReminder() {
    if (!('Notification' in window)) { toast('Les notifications ne sont pas disponibles sur ce navigateur.'); return; }
    let perm = Notification.permission;
    if (perm === 'default') perm = await Notification.requestPermission();
    if (perm !== 'granted') { toast('Autorise les notifications dans les réglages de ton téléphone pour recevoir le rappel.'); return; }
    if (!(S().settings.plans && S().settings.plans.length) && !S().settings.reminderTime) { toast('Ajoute d’abord un plan pour programmer un rappel.'); return; }
    scheduleReminder();
    render();
  }
  const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  // Prochaine occurrence d'un plan "si-alors" (ou repli sur l'ancien rappel quotidien).
  function nextPlanDate() {
    const now = new Date(); const plans = S().settings.plans || [];
    if (!plans.length) {
      const time = S().settings.reminderTime; if (!time) return null;
      const [h, m] = time.split(':').map(Number); const d = new Date(); d.setHours(h, m, 0, 0);
      if (d <= now) d.setDate(d.getDate() + 1); return { date: d, plan: null };
    }
    const cur = (now.getDay() + 6) % 7; // lundi = 0
    let best = null;
    for (const p of plans) {
      const [h, m] = p.time.split(':').map(Number);
      const d = new Date(now); d.setDate(now.getDate() + ((p.day - cur + 7) % 7)); d.setHours(h, m, 0, 0);
      if (d <= now) d.setDate(d.getDate() + 7);
      if (!best || d < best.date) best = { date: d, plan: p };
    }
    return best;
  }
  let reminderTimeout = null;
  function scheduleReminder() {
    if (reminderTimeout) clearTimeout(reminderTimeout);
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const nx = nextPlanDate(); if (!nx) return;
    const delay = Math.min(nx.date - new Date(), 2 ** 31 - 1);
    reminderTimeout = setTimeout(() => {
      const t = Store.todayTemplate();
      const body = nx.plan && nx.plan.anchor ? `${t.name} · ${nx.plan.anchor}` : `${t.name} · ${t.focus}`;
      try { new Notification('Séance prévue', { body, tag: 'plan' }); } catch (e) {}
      scheduleReminder();
    }, Math.max(0, delay));
  }

  // =====================================================================
  //  ONBOARDING express — une question par écran (levier d'adhérence 2026)
  // =====================================================================
  let onb = null;
  const ONB_STEPS = 6;
  let onbShown = null;
  function startOnboarding() {
    onb = { step: 0, goal: null, experience: null, mode: 6, weight: '', planTime: '18:00',
      increments: { ...S().settings.increments }, planDays: [] };
    showOnboard();
  }
  function showOnboard() {
    let el = document.getElementById('onboard');
    if (!el) { el = document.createElement('div'); el.id = 'onboard'; el.className = 'onboard'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Configuration initiale'); document.body.appendChild(el); }
    el.innerHTML = onboardStep();
    // continuité spatiale : la carte n'entre (dans le sens de la marche) que si l'étape change
    const card = el.firstElementChild;
    if (card && onbShown !== onb.step) { card.classList.add('enter'); card.dataset.dir = onbShown == null ? 0 : Math.sign(onb.step - onbShown); }
    onbShown = onb.step;
    syncOverlayState();
  }
  function closeOnboard() { const el = document.getElementById('onboard'); if (el) el.remove(); syncOverlayState(); }

  function onboardStep() {
    const dots = Array.from({ length: ONB_STEPS }, (_, i) => `<span class="odot ${i === onb.step ? 'on' : ''} ${i < onb.step ? 'past' : ''}"></span>`).join('');
    const nav = (nextLabel, canNext = true) => `
      <div class="onb-nav">
        ${onb.step > 0 ? '<button class="btn ghost" data-action="onb-back">Retour</button>' : '<button class="btn ghost" data-action="onb-skip">Passer l’intro</button>'}
        <button class="btn primary" data-action="${onb.step === ONB_STEPS - 1 ? 'onb-finish' : 'onb-next'}" ${canNext ? '' : 'disabled'}>${nextLabel}</button>
      </div>`;
    const pick = (action, val, cur, label, sub) => `<button class="onb-pick ${cur === val ? 'on' : ''}" data-action="${action}" data-v="${val}"><b>${label}</b>${sub ? `<span>${sub}</span>` : ''}</button>`;

    let body = '';
    if (onb.step === 0) {
      body = `<div class="onb-seal" aria-hidden="true"></div>
        <h2>Bienvenue dans Chronographe</h2>
        <p class="onb-lead">Ton coach de musculation, <b>100 % sur ton téléphone</b>. Aucune donnée ne sort, même pas via un serveur. Trois questions rapides et on est prêts.</p>
        ${nav('Commencer')}`;
    } else if (onb.step === 1) {
      body = `<div class="onb-eye">Ton objectif</div><h2>Où tu veux aller ?</h2>
        <div class="onb-list">
          ${pick('onb-goal', 'masse', onb.goal, 'Prise de masse', 'Gagner du muscle, surplus léger')}
          ${pick('onb-goal', 'recomp', onb.goal, 'Recomposition', 'Muscle + perte de gras')}
          ${pick('onb-goal', 'seche', onb.goal, 'Sèche', 'Perdre du gras, garder le muscle')}
        </div>${nav('Continuer', !!onb.goal)}`;
    } else if (onb.step === 2) {
      body = `<div class="onb-eye">Ton expérience</div><h2>Tu t’entraînes depuis…</h2>
        <div class="onb-list">
          ${pick('onb-exp', 'debutant', onb.experience, 'Débutant', 'Moins d’un an')}
          ${pick('onb-exp', 'intermediaire', onb.experience, 'Intermédiaire', '1 à 3 ans')}
          ${pick('onb-exp', 'avance', onb.experience, 'Avancé', 'Plus de 3 ans')}
        </div>${nav('Continuer', !!onb.experience)}`;
    } else if (onb.step === 3) {
      const inc = onb.increments;
      body = `<div class="onb-eye">Ta salle</div><h2>Incréments de charge</h2>
        <p class="onb-lead">Pour n’arrondir qu’à ce qui existe chez toi. On a mis des valeurs classiques.</p>
        <div class="onb-fields">
          <label class="field"><span>Haltères (kg)</span><input class="num" inputmode="decimal" data-action="onb-inc" data-k="haltère" value="${inc['haltère']}"></label>
          <label class="field"><span>Barre + disques (kg)</span><input class="num" inputmode="decimal" data-action="onb-inc" data-k="barre" value="${inc['barre']}"></label>
          <label class="field"><span>Machines (kg)</span><input class="num" inputmode="decimal" data-action="onb-inc" data-k="machine" value="${inc['machine']}"></label>
        </div>${nav('Continuer')}`;
    } else if (onb.step === 4) {
      body = `<div class="onb-eye">Ton rythme</div><h2>Combien de jours par semaine ?</h2>
        <div class="onb-list">
          ${pick('onb-mode', '6', String(onb.mode), '6 jours · PPL', 'Push/Pull/Legs A-B, 1 repos')}
          ${pick('onb-mode', '4', String(onb.mode), '4 jours · Upper/Lower', 'Plus de récupération')}
        </div>
        <label class="field mt14"><span>Poids de corps aujourd’hui (optionnel, kg)</span><input class="num" inputmode="decimal" data-action="onb-weight" value="${onb.weight}" placeholder="ex. 78"></label>
        ${nav('Continuer')}`;
    } else if (onb.step === 5) {
      body = `<div class="onb-eye">Ton plan</div><h2>Quand t’entraînes-tu ?</h2>
        <p class="onb-lead">Accrocher la séance à un moment fixe multiplie l’adhérence. Choisis tes jours et une heure.</p>
        <div class="onb-days">${DAY_NAMES.map((d, i) => `<button class="day-chip ${onb.planDays.includes(i) ? 'on' : ''}" data-action="onb-day" data-d="${i}">${d.slice(0, 3)}</button>`).join('')}</div>
        <label class="field mt14"><span>Heure</span><input type="time" data-action="onb-time" value="${onb.planTime}"></label>
        <p class="onb-mini">${onb.planDays.length ? `Rappel : « ${DAY_NAMES[onb.planDays[0]]} ${onb.planTime} — ta séance t’attend. »` : 'Tu pourras activer les rappels ensuite dans les réglages.'}</p>
        ${nav('Terminer')}`;
    }
    return `<div class="onb-card view"><div class="odots">${dots}</div>${body}</div>`;
  }

  async function finishOnboarding() {
    const s = S().settings;
    s.increments = onb.increments;
    s.profile = { goal: onb.goal, experience: onb.experience, weight: num(onb.weight) };
    s.plans = onb.planDays.map(d => ({ id: 'p' + d + '_' + Date.now(), day: d, time: onb.planTime, anchor: '' }));
    s.onboarded = true;
    await Store.saveSettings();
    if (onb.mode !== S().settings.mode) await Store.setMode(onb.mode);
    if (num(onb.weight)) { const entry = { id: Date.now(), date: new Date().toISOString(), weight: num(onb.weight), measures: {} }; await Store.saveBody(entry); S().body.push(entry); }
    onb = null; closeOnboard(); go('home');
  }

  // =====================================================================
  //  Suivi corporel — ajout d'une mesure
  // =====================================================================
  function openBodySheet() {
    const last = (S().body || []).slice(-1)[0];
    const m = (last && last.measures) || {};
    openSheet(`<div class="grab"></div><h2>Nouvelle mesure</h2>
      <p class="muted lead">Tout reste en local. Le poids suffit ; les mensurations sont optionnelles.</p>
      <label class="field"><span>Poids de corps (kg)</span><input class="num" inputmode="decimal" id="bd-weight" value="${last && last.weight != null ? last.weight : ''}" placeholder="ex. 78.4"></label>
      <div class="row mt10">
        <label class="field grow"><span>Bras (cm)</span><input class="num" inputmode="decimal" id="bd-bras" value="${m.bras ?? ''}"></label>
        <label class="field grow"><span>Poitrine (cm)</span><input class="num" inputmode="decimal" id="bd-poitrine" value="${m.poitrine ?? ''}"></label>
      </div>
      <div class="row mt10">
        <label class="field grow"><span>Taille (cm)</span><input class="num" inputmode="decimal" id="bd-taille" value="${m.taille ?? ''}"></label>
        <label class="field grow"><span>Cuisse (cm)</span><input class="num" inputmode="decimal" id="bd-cuisse" value="${m.cuisse ?? ''}"></label>
      </div>
      <button class="btn primary block mt16" data-action="body-save">Enregistrer la mesure</button>`);
  }
  async function saveBodyForm() {
    const g = (x) => num(document.getElementById(x).value);
    const measures = {}; for (const k of ['bras', 'poitrine', 'taille', 'cuisse']) { const v = g('bd-' + k); if (v != null) measures[k] = v; }
    const weight = g('bd-weight');
    if (weight == null && !Object.keys(measures).length) { closeSheet(); return; }
    const entry = { id: Date.now(), date: new Date().toISOString(), weight, measures };
    await Store.saveBody(entry); S().body.push(entry);
    closeSheet(); render();
  }

  function openPlanSheet() {
    openSheet(`<div class="grab"></div><h2>Nouveau plan « si-alors »</h2>
      <p class="muted lead">« Si [jour · heure], alors ta séance. » Choisis les jours :</p>
      <div class="onb-days" id="plan-days">${DAY_NAMES.map((d, i) => `<button class="day-chip" data-action="plan-day-toggle" data-d="${i}">${d.slice(0, 3)}</button>`).join('')}</div>
      <label class="field mt12"><span>Heure</span><input type="time" id="plan-time" value="18:00"></label>
      <label class="field mt10"><span>Ancre (optionnel)</span><input id="plan-anchor" placeholder="ex. en sortant du boulot"></label>
      <button class="btn primary block mt16" data-action="plan-create">Ajouter le plan</button>`);
  }

  function init() {
    document.getElementById('boot').style.display = 'none';
    // Délégation au niveau document : couvre #app, la tabbar, les sheets et l'overlay timer
    // (tous rendus hors de #app).
    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    document.addEventListener('input', (e) => { const a = e.target.dataset && e.target.dataset.action; if (a === 'cardio-dur' || a === 'lib-search' || a === 'plate-target' || a === 'orm' || a === 'pick-search') onChange(e); });
    // Échap : ferme la feuille ouverte, sinon passe le repos (accessibilité clavier / desktop).
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (document.getElementById('sheet')) closeSheet();
      else if (timer) stopTimer();
    });
    scheduleReminder();
    render();
    if (!S().settings.onboarded) startOnboarding();
  }

  window.UI = { init };
})();
