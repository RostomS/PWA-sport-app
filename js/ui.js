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
    lib: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3H18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 18.5v-13A2.5 2.5 0 0 1 6.5 3z"/><path d="M8 3v18"/></svg>',
    progress: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5-5 4 4 8-8"/><path d="M21 8v4M21 8h-4"/></svg>',
    more: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
  };
  const TABS = [['home', 'Aujourd’hui', IC.home], ['volume', 'Volume', IC.volume], ['lib', 'Biblio', IC.lib], ['progress', 'Progrès', IC.progress], ['more', 'Réglages', IC.more]];

  function renderTabs() {
    const tb = document.getElementById('tabbar'); tb.hidden = false;
    tb.innerHTML = TABS.map(([r, label, ic]) =>
      `<button data-nav="${r}" ${route === r ? 'aria-current="page"' : ''}><span class="ic">${ic}</span>${label}</button>`).join('');
  }

  function go(r) { route = r; render(); window.scrollTo(0, 0); }

  // =====================================================================
  //  RENDER dispatch
  // =====================================================================
  function render() {
    const v = { home: viewHome, session: viewSession, volume: viewVolume, lib: viewLibrary, progress: viewProgress, more: viewMore, program: viewProgram }[route] || viewHome;
    app().innerHTML = `<div class="view">${topbar()}${v()}</div>`;
    renderTabs();
  }
  const topbar = () => `<div class="topbar"><div class="brand"><span class="mark"></span>Chronographe <small>local</small></div>${route !== 'home' && route !== 'session' ? '' : ''}</div>`;

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
      ? `<button class="btn primary block cta" data-nav="session">Reprendre ${esc(draft.name)} ▸</button>`
      : `<button class="btn primary block cta" data-action="start-picker">Démarrer ${esc(t.name)} ▸</button>`;

    return `
    ${banners(dl, fatigue4)}
    <section class="hero">
      <div class="eyebrow">Aujourd’hui</div>
      <div class="session-name">${esc(t.name)}</div>
      <div class="focus">${esc(t.focus)}</div>
      <div class="readout">
        <span><b>~${est}</b> min séance</span>
        <span><b>+${cardio}</b> min cardio</span>
        <span><b>${blocks.length}</b> exos</span>
      </div>
      <div class="status">${status.join('')}</div>
      ${cta}
    </section>

    <div class="between" style="margin:22px 2px 10px"><div class="eyebrow">À suivre</div>
      <button class="btn ghost sm" data-action="reorder">Changer de séance</button></div>
    <div class="upnext">
      ${up.map(x => `<div class="mini" data-action="preview-session" data-id="${esc(x.id)}"><div class="k">${esc(x.code)}</div><div class="n">${esc(x.name)}</div><div class="muted num" style="font-size:11px;margin-top:4px">~${Logic.estimateMinutes(Logic.activeBlocks(x))} min</div></div>`).join('')}
    </div>

    <div class="card pad" style="margin-top:22px">
      <div class="between"><div class="eyebrow">Régularité · 4 semaines</div>
        <button class="btn ghost sm" data-nav="progress">Détail</button></div>
      ${miniRegularity()}
    </div>`;
  }

  function banners(dl, fatigue4) {
    let out = '';
    if (dl.due) out += `<div class="banner amber" style="margin-bottom:12px"><div><div class="ttl">5 semaines depuis le dernier deload</div><div class="body">Une semaine allégée (mêmes charges, −40% de séries) protège ta progression.</div><div class="acts"><button class="btn steel sm" data-action="apply-deload">Alléger cette semaine</button><button class="btn ghost sm" data-action="dismiss-deload">Plus tard</button></div></div></div>`;
    if (dl.active) out += `<div class="banner info" style="margin-bottom:12px"><div><div class="ttl">Semaine de deload active</div><div class="body">Volume réduit de 40%. Reste sur tes charges, laisse le corps récupérer.</div></div></div>`;
    if (fatigue4) out += `<div class="banner amber" style="margin-bottom:12px"><div><div class="ttl">Deux check-ins fatigués d’affilée</div><div class="body">Tu peux passer en mode 4 jours (Upper/Lower) le temps de récupérer. Rien n’est perdu, tu reviendras au 6 jours quand tu veux.</div><div class="acts"><button class="btn steel sm" data-action="to-4day">Passer en 4 jours</button><button class="btn ghost sm" data-action="dismiss-fatigue">Rester en 6 jours</button></div></div></div>`;
    return out;
  }

  function miniRegularity() {
    const days = Logic.regularityDays(4);
    const today = new Date().toDateString();
    return `<div class="cal" style="margin-top:10px">${days.map(d => `<div class="d ${d.done ? 'done' : ''} ${d.date.toDateString() === today ? 'today' : ''}"></div>`).join('')}</div>`;
  }

  // =====================================================================
  //  2) SÉANCE ACTIVE — déroulé ordonné + log + timer + progression
  // =====================================================================
  function viewSession() {
    const d = S().draft;
    if (!d) return `<div class="empty"><div class="big">Aucune séance en cours</div><button class="btn primary" data-nav="home">Retour à l’accueil</button></div>`;
    const cards = d.blocks.map((b, i) => sessionCard(b, i, d.blocks.length)).join('');
    const doneCount = d.blocks.filter(b => b.sets.some(s => s.done)).length;
    return `
      <div class="between" style="margin-bottom:14px">
        <div><div class="eyebrow">Séance en cours</div><h1 style="font-size:26px">${esc(d.name)}</h1></div>
        <button class="btn ghost sm" data-action="abort">Quitter</button>
      </div>
      ${d.note ? `<details class="why"><summary>Pourquoi cet ordre ?</summary><p>${esc(d.note)}</p><p class="why-rule">Règle générale : le compound le plus lourd en premier (tu es frais → plus de charge et plus de sécurité). L’ordre pèse surtout sur la force ; pour le muscle, c’est le volume près de l’échec qui compte — alors donne tout sur chaque série.</p></details>` : ''}
      ${d.dropped && d.dropped.length ? `<div class="banner info" style="margin-bottom:14px"><div><div class="ttl">Séance recomposée · ${d.timeBudget} min</div><div class="body">J’ai gardé les compounds prioritaires et coupé : ${esc(d.dropped.join(', '))}.</div></div></div>` : ''}
      <ol class="ex-list">${cards}</ol>
      ${finisherCard(d)}
      <button class="btn primary block" style="margin-top:16px" data-action="finish">Terminer la séance · ${doneCount}/${d.blocks.length} exos</button>
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
        <button class="set-check ${logged ? 'on' : ''}" data-action="toggle-set" data-b="${i}" data-s="${si}" aria-pressed="${logged}" aria-label="Valider la série ${si + 1}">${logged ? '✓' : '○'}</button>
      </div>`;
    }).join('');

    return `<li class="ex-card ${done ? 'done' : ''}">
      <span class="ord">${i + 1}</span>
      <div class="ex-head">
        ${ILLU.svgFor(ex.pattern, ex.musclePrimary)}
        <div style="flex:1;min-width:0">
          <div class="between"><div class="ex-title">${esc(ex.name)}</div>
            <div class="row" style="gap:4px;flex:0 0 auto">${ex.elbowUnsafe ? '<span class="avoid-flag">à éviter</span>' : ''}
              <button class="mv" data-action="move-ex" data-b="${i}" data-dir="-1" aria-label="Monter l’exercice" ${i === 0 ? 'disabled' : ''}>▲</button>
              <button class="mv" data-action="move-ex" data-b="${i}" data-dir="1" aria-label="Descendre l’exercice" ${i === nBlocks - 1 ? 'disabled' : ''}>▼</button>
            </div></div>
          <div class="ex-meta">${esc(ex.musclePrimary)} · ${esc(ex.equipment)}${b.substitutedFrom ? ' · remplacé' : ''}${b.superset ? ' · superset' : ''}</div>
          <div class="ex-target num">Cible ${target}</div>
          ${b.note ? `<div class="ex-note-line">📝 ${esc(b.note)}</div>` : ''}
        </div>
      </div>
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
        <button class="btn sm ghost" data-action="ex-note" data-b="${i}">📝 Note${b.note ? ' •' : ''}</button>
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
    return `<div class="card pad" style="margin-top:14px">
      <div class="between"><div class="eyebrow">Finisher cardio</div>
        <button class="set-check ${c.done ? 'on' : ''}" data-action="toggle-cardio" aria-label="Cardio fait" style="width:38px;height:34px">${c.done ? '✓' : '○'}</button></div>
      <div class="ex-meta" style="margin:6px 0 12px">Marche inclinée · faible impact, préserve la récupération</div>
      <label class="field"><span>Durée · <b class="num" id="cardio-dur-val">${c.duration}</b> min</span>
        <input type="range" min="20" max="30" step="1" value="${c.duration}" data-action="cardio-dur"></label>
      <div class="row" style="margin-top:12px">
        <label class="field" style="flex:1"><span>Inclinaison %</span><input class="num" inputmode="decimal" value="${c.incline}" data-action="cardio-incline"></label>
        <label class="field" style="flex:1"><span>Vitesse km/h</span><input class="num" inputmode="decimal" value="${c.speed}" data-action="cardio-speed"></label>
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
    <h1 style="font-size:26px;margin-bottom:4px">Volume de la semaine</h1>
    <p class="muted" style="margin:0 0 14px;font-size:13px">Séries travaillées par muscle. Cible 12–24 ; en déficit, vise la zone réaliste 12–18. Au-delà de 20–22, rendement décroissant.</p>
    <div class="card pad" style="margin-bottom:14px">
      <div class="musclemap">${bodyMapSVG(zmap)}</div>
      <div class="bm-legend">
        <span><i style="background:var(--steel)"></i>en construction</span>
        <span><i style="background:var(--signal)"></i>réaliste</span>
        <span><i style="background:var(--amber)"></i>haut</span>
        <span><i style="background:var(--danger)"></i>rendement ↓</span>
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
        <div class="muted" style="font-size:11px;margin:2px 0 0 102px">${zoneLabel[r.zone]}${r.zone === 'over' ? ' ⚠︎' : ''}</div>`;
      }).join('')}
    </div>
    <p class="muted" style="font-size:12px;margin-top:14px;padding:0 4px">La bande claire marque la zone 12–18 séries. Le compteur ne fait pas de morale : il rend visible où va réellement ton volume.</p>`;
  }

  // =====================================================================
  //  BIBLIOTHÈQUE — CRUD complet
  // =====================================================================
  let libFilter = '';
  let libTab = 'exos'; // 'exos' | 'seances'
  function viewLibrary() {
    return `
    <div class="between" style="margin-bottom:12px"><h1 style="font-size:26px">Bibliothèque</h1>
      ${libTab === 'exos' ? '<button class="btn primary sm" data-action="new-exercise">+ Exercice</button>' : ''}</div>
    <div class="seg2" style="margin-bottom:14px">
      <button class="seg-btn ${libTab === 'exos' ? 'on' : ''}" data-action="lib-tab" data-tab="exos">Exercices</button>
      <button class="seg-btn ${libTab === 'seances' ? 'on' : ''}" data-action="lib-tab" data-tab="seances">Séances</button>
    </div>
    ${libTab === 'exos' ? libExercises() : libSeances()}`;
  }

  function libExercises() {
    const q = libFilter.toLowerCase();
    const list = S().exercises
      .filter(e => e.musclePrimary !== 'Cardio')
      .filter(e => !q || e.name.toLowerCase().includes(q) || e.musclePrimary.toLowerCase().includes(q))
      .sort((a, b) => (a.archived - b.archived) || a.musclePrimary.localeCompare(b.musclePrimary) || a.name.localeCompare(b.name));
    return `
    <input placeholder="Rechercher un exercice ou un muscle…" value="${esc(libFilter)}" data-action="lib-search" style="margin-bottom:14px">
    <div class="card">
      ${list.map(e => `<div class="lib-item ${e.archived ? 'archived' : ''}">
        ${ILLU.svgFor(e.pattern, e.musclePrimary)}
        <div style="flex:1;min-width:0">
          <div class="ex-title" style="font-size:15px">${esc(e.name)} ${e.elbowUnsafe ? '<span class="avoid-flag">à éviter</span>' : ''}</div>
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
      <div><div class="eyebrow">Programme actif</div><div class="ex-title" style="font-size:15px">${esc(prog.name)}</div><div class="ex-meta">${esc(prog.days)}</div></div>
      <button class="btn ghost sm" data-action="prog-detail" data-id="${prog.id}">Le pourquoi</button>
    </div>
    ${order.map(code => `<div class="eyebrow" style="margin:18px 2px 8px">${esc(CODE_LABEL[code] || code)}</div>
      <div class="card">${groups[code].map(t => `<div class="lib-item prog-row" data-action="preview-session" data-id="${esc(t.id)}">
        ${ILLU.svgFor(t.blocks[0] && (S().ex(t.blocks[0].exId) || {}).pattern || 'isolation', '')}
        <div style="flex:1;min-width:0"><div class="ex-title" style="font-size:15px">${esc(t.name)}</div><div class="ex-meta">${esc(t.focus)} · ${t.blocks.length} exos · ~${Logic.estimateMinutes(t.blocks)} min</div></div>
        <span class="badge-eq">Aperçu ▸</span></div>`).join('')}</div>`).join('')}
    <p class="muted" style="font-size:12px;margin-top:14px;padding:0 4px">Touche une séance pour la prévisualiser en entier, puis la lancer directement. Change de programme dans les Réglages.</p>`;
  }

  function openSessionPreview(id) {
    const t = Store.templateById(id); if (!t) return;
    const isActive = Store.currentOrder().some(x => x.id === id);
    const rows = t.blocks.map((b, i) => {
      const ex = S().ex(b.exId); if (!ex) return '';
      const rng = `${ex.repMin}${ex.repMax !== ex.repMin ? '-' + ex.repMax : ''}`;
      const target = ex.perLeg ? `${b.sets}×${rng}/j` : `${b.sets}×${rng}`;
      return `<div class="lib-item"><span class="prev-ord num">${i + 1}</span>${ILLU.svgFor(ex.pattern, ex.musclePrimary)}
        <div style="flex:1;min-width:0"><div class="ex-title" style="font-size:14px">${esc(ex.name)}${ex.elbowUnsafe ? ' <span class="avoid-flag">à éviter</span>' : ''}</div><div class="ex-meta">${esc(ex.musclePrimary)} · ${esc(ex.equipment)}</div></div>
        <div class="ex-target num">${target}</div></div>`;
    }).join('');
    openSheet(`<div class="grab"></div>
      <div class="eyebrow">${esc(CODE_LABEL[t.code] || t.code)}</div>
      <h2 style="font-size:22px;margin:2px 0 4px">${esc(t.name)}</h2>
      <div class="ex-meta">${esc(t.focus)} · ~${Logic.estimateMinutes(t.blocks)} min · ${t.blocks.length} exercices</div>
      ${t.note ? `<details class="why" open style="margin-top:12px"><summary>Pourquoi cet ordre ?</summary><p>${esc(t.note)}</p></details>` : ''}
      <div class="card" style="margin-top:12px">${rows}</div>
      ${isActive ? `<button class="btn primary block" style="margin-top:14px" data-action="do-session" data-id="${esc(id)}">Faire cette séance maintenant</button>` : '<p class="muted" style="font-size:12px;text-align:center;margin-top:12px">Aperçu — active ce programme dans les Réglages pour la faire.</p>'}`);
  }

  function exerciseForm(ex) {
    const patterns = [['push-h', 'Poussée horizontale'], ['push-v', 'Poussée verticale'], ['pull-h', 'Tirage horizontal'], ['pull-v', 'Tirage vertical'], ['hinge', 'Hinge (charnière)'], ['squat', 'Squat'], ['curl', 'Curl'], ['extension', 'Extension'], ['isolation', 'Isolation (autre)']];
    const equips = ['haltère', 'barre', 'câble', 'machine', 'poids du corps'];
    const isNew = !ex;
    ex = ex || { id: '', name: '', musclePrimary: 'Pectoraux', equipment: 'haltère', pattern: 'push-h', repMin: 8, repMax: 12, role: 'isolation', elbowSensitive: false, elbowUnsafe: false, tips: [], biomech: '', archived: false, custom: true, restSec: null };
    return `<div class="grab"></div>
      <h2 style="margin-bottom:4px">${isNew ? 'Nouvel exercice' : 'Éditer l’exercice'}</h2>
      <p class="muted" style="font-size:13px;margin:0 0 16px">${isNew ? 'Son illustration sera générée automatiquement depuis le pattern choisi.' : 'Tu peux modifier chaque champ, y compris sur un exercice de base.'}</p>
      <div class="row" style="align-items:center;margin-bottom:14px"><div id="form-illu">${ILLU.svgFor(ex.pattern, ex.musclePrimary)}</div><span class="muted" style="font-size:12px">Aperçu du schéma généré</span></div>
      <div class="stack">
        <label class="field"><span>Nom</span><input id="f-name" value="${esc(ex.name)}"></label>
        <div class="row">
          <label class="field" style="flex:1"><span>Muscle principal</span><select id="f-muscle">${DATA.MUSCLE_GROUPS.map(m => `<option ${m === ex.musclePrimary ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
          <label class="field" style="flex:1"><span>Équipement</span><select id="f-equip">${equips.map(m => `<option ${m === ex.equipment ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
        </div>
        <label class="field"><span>Pattern de mouvement (définit l’illustration)</span><select id="f-pattern" data-action="pattern-change">${patterns.map(([v, l]) => `<option value="${v}" ${v === ex.pattern ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <div class="row">
          <label class="field" style="flex:1"><span>Reps min</span><input class="num" inputmode="numeric" id="f-repmin" value="${ex.repMin}"></label>
          <label class="field" style="flex:1"><span>Reps max</span><input class="num" inputmode="numeric" id="f-repmax" value="${ex.repMax}"></label>
          <label class="field" style="flex:1"><span>Rôle</span><select id="f-role"><option value="compound" ${ex.role === 'compound' ? 'selected' : ''}>Compound</option><option value="isolation" ${ex.role === 'isolation' ? 'selected' : ''}>Isolation</option></select></label>
        </div>
        <label class="field"><span>Repos entre séries (s) — vide = réglage global</span><input class="num" inputmode="numeric" id="f-rest" value="${ex.restSec ?? ''}" placeholder="${(S().settings.restByRole[ex.role] || 120)}"></label>
        <label class="field"><span>Note biomécanique (courte)</span><textarea id="f-bio" rows="2">${esc(ex.biomech || '')}</textarea></label>
        <label class="field"><span>Tips d’exécution (une ligne chacun)</span><textarea id="f-tips" rows="3">${esc((ex.tips || []).join('\n'))}</textarea></label>
        <label class="row" style="gap:8px"><input type="checkbox" id="f-elbow" style="width:auto" ${ex.elbowSensitive ? 'checked' : ''}><span style="font-size:13px">Coude sensible (rappel mobilité pendant le repos)</span></label>
        <label class="row" style="gap:8px"><input type="checkbox" id="f-unsafe" style="width:auto" ${ex.elbowUnsafe ? 'checked' : ''}><span style="font-size:13px">Élongation contre-indiquée coude (marqué « à éviter »)</span></label>
      </div>
      <div class="row" style="margin-top:18px">
        <button class="btn primary block" data-action="save-exercise" data-id="${esc(ex.id)}">${isNew ? 'Créer l’exercice' : 'Enregistrer'}</button>
      </div>
      ${!isNew ? `<button class="btn block ${ex.archived ? 'steel' : 'danger'}" style="margin-top:10px" data-action="archive-exercise" data-id="${esc(ex.id)}">${ex.archived ? 'Réactiver l’exercice' : 'Archiver (garde l’historique lisible)'}</button>` : ''}`;
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
    <h1 style="font-size:26px;margin-bottom:12px">Progrès</h1>

    <div class="card pad">
      <div class="between"><div class="eyebrow">Régularité · 4 semaines</div><span class="chip ok num">${perWeek} / sem.</span></div>
      <div style="margin-top:12px">${weeks.map(w => `<div class="cal" style="margin-bottom:6px">${w.map(d => `<div class="d ${d.done ? 'done' : ''} ${d.date.toDateString() === today ? 'today' : ''}"></div>`).join('')}</div>`).join('')}</div>
      <div class="cons">
        <div class="cons-band">${cons.weeks.map(w => `<span class="cpip ${w.trained ? 'on' : ''}"></span>`).join('')}</div>
        <div class="cons-msg">${cons.run > 0 ? `💪 ${cons.run} semaine${cons.run > 1 ? 's' : ''} active${cons.run > 1 ? 's' : ''} d’affilée` : 'Nouvelle semaine — la première séance relance la dynamique.'}</div>
      </div>
      <p class="muted" style="font-size:12px;margin:10px 0 0">${doneCount} séance${doneCount > 1 ? 's' : ''} sur 4 semaines. Une pause n’efface rien et ne casse aucun compteur — on lit la régularité réelle, sans pression.</p>
    </div>

    <h2 style="font-size:18px;margin:22px 2px 10px">Corps</h2>
    <div class="card pad">
      <div class="between"><div class="eyebrow">Poids de corps</div><button class="btn ghost sm" data-action="body-add">+ Mesure</button></div>
      ${bs.count ? `
        <div class="row" style="align-items:baseline;gap:12px;margin-top:8px">
          <span class="num" style="font-size:28px;font-weight:700">${bs.latest.weight != null ? bs.latest.weight : '—'}<span style="font-size:13px" class="muted"> kg</span></span>
          ${bs.delta != null ? `<span class="delta ${bs.delta < 0 ? 'up' : bs.delta > 0 ? 'down' : 'flat'}">${bs.delta > 0 ? '+' : ''}${bs.delta} kg${bs.spanDays ? ` · ${bs.spanDays} j` : ''}</span>` : ''}
        </div>
        ${bs.series.length > 1 ? `<div style="margin-top:10px">${sparkSVG(bs.series, 260, 60, 'var(--steel)')}</div>` : ''}
        ${Object.keys(bs.latest.measures || {}).length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px">${Object.entries(bs.latest.measures).map(([k, v]) => `<span class="chip ghost">${esc(k)} ${v} cm</span>`).join('')}</div>` : ''}
      ` : `<div class="empty" style="padding:14px"><div class="big">Aucune mesure</div>Note ton poids pour suivre la tendance, utile en déficit.</div>`}
    </div>

    ${rc.samples >= 3 ? `<h2 style="font-size:18px;margin:22px 2px 10px">Calibration RIR</h2>
    <div class="card pad">
      <div class="between"><div class="eyebrow">Précision de ton ressenti</div><span class="chip ${rc.bias >= 1.5 ? 'warn' : 'ok'} num">${rc.bias >= 1.5 ? 'à ajuster' : 'fiable'}</span></div>
      <p class="muted" style="font-size:13px;margin:8px 0 0">Sur tes ${rc.samples} séries menées à l’échec, tu annonçais en moyenne <b class="num">RIR ${rc.bias}</b>. ${rc.bias >= 1.5 ? `Tu surestimes tes reps en réserve d’environ ${Math.round(rc.bias)} — pousse un peu plus près de l’échec, surtout sur les isolations.` : 'Ton ressenti colle à la réalité — continue comme ça.'}</p>
    </div>` : ''}

    <h2 style="font-size:18px;margin:22px 2px 10px">Outils</h2>
    <div class="card pad"><div class="between"><div><div class="ex-title" style="font-size:14px">Calculateur 1RM &amp; %</div><div class="ex-meta">Estime ton max et la charge à chaque pourcentage.</div></div><button class="btn sm steel" data-action="one-rm">Ouvrir</button></div></div>

    <h2 style="font-size:18px;margin:22px 2px 10px">Progression par exercice</h2>
    ${exs.length ? `<div class="card">${exs.map(x => {
      const ser = Logic.e1rmSeries(x.id); const vals = ser.map(p => p.value);
      const first = vals[0] || 0, lastV = vals[vals.length - 1] || 0; const pct = first ? Math.round((lastV - first) / first * 100) : 0;
      return `<div class="lib-item prog-row" data-action="ex-progress" data-id="${x.id}">
        <div style="flex:1;min-width:0"><div class="ex-title" style="font-size:14px">${esc(x.ex.name)}</div><div class="ex-meta">1RM est. ${lastV.toFixed(0)} kg · ${ser.length} séance${ser.length > 1 ? 's' : ''}</div></div>
        <div class="prog-spark">${sparkSVG(vals, 120, 34)}</div>
        <div class="delta ${pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat'}" style="min-width:44px;justify-content:flex-end">${pct > 0 ? '+' : ''}${pct}%</div>
      </div>`;
    }).join('')}</div>` : `<div class="empty">Tes courbes de progression apparaîtront ici après quelques séances.</div>`}

    <h2 style="font-size:18px;margin:22px 2px 10px">Records</h2>
    ${prs.length ? `<div class="card">${prs.slice(0, 8).map(p => `<div class="lib-item"><span class="chip pr">PR</span><div style="flex:1"><div class="ex-title" style="font-size:14px">${esc(p.name)}</div><div class="ex-meta">${esc(p.pr.label)}</div></div><div class="muted num" style="font-size:11px">${fmtDate(p.date)}</div></div>`).join('')}</div>` : `<div class="empty">Tes records apparaîtront ici dès ta première séance loggée.</div>`}

    <h2 style="font-size:18px;margin:22px 2px 10px">Historique</h2>
    ${hist.length ? `<div class="card">${hist.map(s => `<div class="lib-item prog-row" data-action="session-detail" data-id="${s.id}"><div style="flex:1;min-width:0"><div class="ex-title" style="font-size:14px">${esc(s.name)}</div><div class="ex-meta">${s.entries.length} exos · ${s.entries.reduce((a, e) => a + e.sets.filter(x => x.done && x.type !== 'warm').length, 0)} séries${s.checkin ? ' · check-in fait' : ''}${s.note ? ' · 📝' : ''}</div></div><div class="muted num" style="font-size:11px">${fmtDate(s.date)}</div></div>`).join('')}</div>` : `<div class="empty"><div class="big">Aucune séance encore</div>Lance ta première séance depuis l’accueil.</div>`}`;
  }

  function openSessionDetail(id) {
    const s = S().sessions.find(x => x.id === id); if (!s) return;
    const d = new Date(s.date);
    const rows = s.entries.map(e => {
      const work = e.sets.filter(x => x.done && x.type !== 'warm');
      const best = work.reduce((a, x) => (x.weight || 0) * (x.reps || 0) > (a.weight || 0) * (a.reps || 0) ? x : a, work[0] || {});
      return `<div class="lib-item"><div style="flex:1"><div class="ex-title" style="font-size:13px">${esc(e.resolvedName || (S().ex(e.exId) || {}).name || e.exId)}</div><div class="ex-meta">${work.length} série${work.length > 1 ? 's' : ''}${best && best.weight != null ? ` · top ${best.weight} kg × ${best.reps}` : ''}</div>${e.note ? `<div class="ex-note-line">📝 ${esc(e.note)}</div>` : ''}</div>${(e.prs || []).length ? '<span class="chip pr">PR</span>' : ''}</div>`;
    }).join('');
    openSheet(`<div class="grab"></div>
      <div class="eyebrow">${d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}</div>
      <h2 style="font-size:22px;margin:2px 0 12px">${esc(s.name)}</h2>
      ${s.note ? `<div class="banner info" style="margin-bottom:12px"><div><div class="ttl">Note</div><div class="body">${esc(s.note)}</div></div></div>` : ''}
      <div class="card">${rows || '<div class="empty" style="padding:12px">Séance sans série loggée.</div>'}</div>
      ${s.checkin ? `<div class="ex-meta" style="margin-top:10px">Check-in · énergie ${['—', 'basse', 'correcte', 'top'][s.checkin.energy] || '—'} · sommeil ${['—', 'court', 'correct', 'excellent'][s.checkin.sleep] || '—'}</div>` : ''}
      <button class="btn danger block" style="margin-top:16px" data-action="session-delete" data-id="${s.id}">Supprimer cette séance</button>
      <p class="muted" style="font-size:11px;text-align:center;margin-top:8px">La rotation n’est pas affectée — seule l’analyse (volume, records) est recalculée.</p>`);
  }

  function openExProgress(id) {
    const ex = S().ex(id); if (!ex) return;
    const ser = Logic.e1rmSeries(id);
    const vals = ser.map(p => p.value), vols = ser.map(p => p.volume);
    const first = vals[0] || 0, lastV = vals[vals.length - 1] || 0, pct = first ? Math.round((lastV - first) / first * 100) : 0;
    openSheet(`<div class="grab"></div>
      <h2 style="font-size:20px">${esc(ex.name)}</h2>
      <div class="ex-meta" style="margin:2px 0 14px">${esc(ex.musclePrimary)} · ${esc(ex.equipment)}</div>
      <div class="card pad"><div class="between"><div class="eyebrow">1RM estimé</div><span class="delta ${pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat'}">${pct > 0 ? '+' : ''}${pct}% · ${lastV.toFixed(1)} kg</span></div>
        <div style="margin-top:10px">${sparkSVG(vals, 260, 78)}</div>
        ${ser.length ? `<button class="btn sm ghost" style="margin-top:10px" data-action="one-rm-ex" data-id="${esc(id)}">Calculer mes %</button>` : ''}</div>
      <div class="card pad" style="margin-top:12px"><div class="eyebrow">Volume par séance</div><div style="margin-top:10px">${sparkSVG(vols, 260, 60, 'var(--steel)')}</div></div>
      <h3 style="font-size:15px;margin:16px 2px 8px">Séance par séance</h3>
      <div class="card">${ser.slice().reverse().map(p => `<div class="lib-item"><div style="flex:1"><div class="ex-title num" style="font-size:13px">${p.top.weight} kg × ${p.top.reps}</div><div class="ex-meta">1RM est. ${p.value.toFixed(1)} kg · volume ${p.volume}</div></div><div class="muted num" style="font-size:11px">${fmtDate(p.date)}</div></div>`).join('')}</div>`);
  }

  // Liste filtrable d'exercices pour l'éditeur de programme.
  function pickList(q) {
    const t = Store.templateById(progEdit); if (!t) return '';
    q = (q || '').toLowerCase();
    const opts = S().exercises.filter(x => !x.archived && x.musclePrimary !== 'Cardio' && !t.blocks.some(b => b.exId === x.id))
      .filter(x => !q || x.name.toLowerCase().includes(q) || x.musclePrimary.toLowerCase().includes(q) || x.equipment.toLowerCase().includes(q))
      .sort((a, b) => a.musclePrimary.localeCompare(b.musclePrimary) || a.name.localeCompare(b.name));
    if (!opts.length) return '<div class="empty" style="padding:16px">Aucun exercice ne correspond.</div>';
    return `<div class="card">${opts.map(x => `<div class="lib-item prog-row" data-action="tpl-add-do" data-id="${x.id}">
      ${ILLU.svgFor(x.pattern, x.musclePrimary)}
      <div style="flex:1;min-width:0"><div class="ex-title" style="font-size:14px">${esc(x.name)}</div><div class="ex-meta">${esc(x.musclePrimary)} · ${esc(x.equipment)}</div></div>
      <span class="badge-eq">+</span></div>`).join('')}</div>`;
  }

  function openProgramDetail(id) {
    const pr = DATA.PROGRAMS.find(p => p.id === id); if (!pr) return;
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
      <div class="card pad" style="margin-bottom:12px"><div class="eyebrow" style="margin-bottom:8px">Volume hebdo par muscle (séries)</div><div style="display:flex;gap:6px;flex-wrap:wrap">${covChips}</div><p class="muted" style="font-size:11px;margin:10px 0 0">Tous les groupes sont couverts sur la semaine, y compris mollets et abdos.</p></div>
      <div class="eyebrow" style="margin:4px 0 8px">Les séances &amp; leur logique</div>
      ${sessions.map(t => `<div class="card pad" style="margin-bottom:8px"><div class="between"><b style="font-size:14px">${esc(t.name)}</b><span class="num muted" style="font-size:11px">~${Logic.estimateMinutes(t.blocks)} min</span></div><div class="ex-meta" style="margin-top:2px">${esc(t.focus)}</div>${t.note ? `<div class="ex-meta" style="margin-top:6px;color:var(--ink-2)">${esc(t.note)}</div>` : ''}</div>`).join('')}
      ${active ? '<div class="chip ok" style="margin-top:8px">Programme actif</div>' : `<button class="btn primary block" style="margin-top:12px" data-action="set-program" data-id="${id}">Choisir ce programme</button>`}`);
  }

  // 1RM (Epley) + table de chargement en %
  function ormTable(w, reps, eq) {
    const oneRM = Logic.e1rm(num(w), num(reps));
    if (!oneRM) return '<div class="empty" style="padding:12px">Entre un poids et des reps pour estimer ton max.</div>';
    const rows = [[100, 1], [95, 2], [90, 4], [85, 6], [80, 8], [75, 10], [70, 12], [67, 15]];
    return `<div class="orm-1rm">1RM estimé · <b class="num">${oneRM.toFixed(1)} kg</b></div>
      <div class="orm-table">${rows.map(([pct, r]) => {
        const load = Logic.roundToIncrement(oneRM * pct / 100, eq);
        return `<div class="orm-row"><span class="num" style="color:var(--accent-steel)">${pct}%</span><span class="num" style="font-weight:700">${load} kg</span><span class="muted num">~${r} rep${r > 1 ? 's' : ''}</span></div>`;
      }).join('')}</div>`;
  }
  function openOneRM(prefW, prefR, eq) {
    eq = eq || 'barre';
    openSheet(`<div class="grab"></div><h2>Calculateur 1RM &amp; %</h2>
      <p class="muted" style="font-size:13px;margin:4px 0 12px">Estime ton max (formule d’Epley) et la charge à chaque %, arrondie à tes incréments.</p>
      <div class="row">
        <label class="field" style="flex:1"><span>Poids (kg)</span><input class="num" inputmode="decimal" id="orm-w" value="${prefW ?? ''}" data-action="orm"></label>
        <label class="field" style="flex:1"><span>Reps</span><input class="num" inputmode="numeric" id="orm-r" value="${prefR ?? ''}" data-action="orm"></label>
      </div>
      <label class="field" style="margin-top:10px"><span>Arrondir comme</span><select id="orm-eq" data-action="orm">${['barre', 'haltère', 'machine', 'câble'].map(x => `<option ${x === eq ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <div id="orm-out" style="margin-top:16px">${ormTable(prefW, prefR, eq)}</div>`);
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
      <div class="platelist num" style="margin-top:10px">${pc.ok ? '' : '≈ '}${pc.loaded} kg = barre ${pc.bar} + <b>${list}</b> / côté</div>
      ${pc.ok ? '' : '<div class="muted" style="font-size:12px;text-align:center;margin-top:6px">Charge exacte non atteignable avec tes disques — voici le plus proche en dessous.</div>'}`;
  }
  function openPlateSheet(weight, ex) {
    openSheet(`<div class="grab"></div><h2>Plate calculator</h2>
      <p class="muted" style="font-size:13px;margin:4px 0 12px">${esc(ex.name)} · barre ${S().settings.barWeight} kg. Disques à charger par côté.</p>
      <label class="field"><span>Charge cible (kg)</span><input class="num" inputmode="decimal" id="plate-target" value="${weight || ''}" data-action="plate-target"></label>
      <div id="plate-out" style="margin-top:16px">${plateHTML(weight)}</div>`);
  }

  const fmtDate = (iso) => { const d = new Date(iso); return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }); };

  // =====================================================================
  //  RÉGLAGES / PLUS
  // =====================================================================
  function viewMore() {
    const s = S().settings;
    return `
    <h1 style="font-size:26px;margin-bottom:14px">Réglages</h1>

    <div class="card pad stack">
      <div class="eyebrow">Bibliothèque de programmes</div>
      ${DATA.PROGRAMS.map(pr => { const active = s.programId === pr.id; return `<div class="prog-pick ${active ? 'on' : ''}">
        <button data-action="set-program" data-id="${pr.id}" style="all:unset;cursor:pointer;display:block">
          <div class="between"><b>${esc(pr.name)}</b>${active ? '<span class="chip ok" style="font-size:10px">Actif</span>' : `<span class="badge-eq">${esc(pr.days)}</span>`}</div>
          <div class="ex-meta" style="margin-top:3px">${esc(pr.mode)}</div>
          <div class="ex-meta" style="margin-top:4px">${esc(pr.desc)}</div>
        </button>
        <button class="btn ghost sm" style="margin-top:10px" data-action="prog-detail" data-id="${pr.id}">Voir le programme &amp; le pourquoi</button>
      </div>`; }).join('')}
      <p class="muted" style="font-size:12px;margin:0">Change à tout moment : l’historique reste continu et la rotation repart proprement sur le nouveau programme. Le repli fatigue bascule PPL ↔ Upper/Lower.</p>
    </div>

    <div class="card pad stack" style="margin-top:14px">
      <div class="eyebrow">Programme</div>
      <button class="btn block" data-nav="program">Réorganiser mes séances & exercices</button>
    </div>

    <div class="card pad stack" style="margin-top:14px">
      <div class="eyebrow">Incréments disponibles en salle</div>
      <p class="muted" style="font-size:12px;margin:0">Les suggestions de charge s’arrondiront à ces pas.</p>
      ${Object.entries(s.increments).map(([k, v]) => `<label class="field"><span>${esc(k)} — pas (kg)</span><input class="num" inputmode="decimal" value="${v}" data-action="increment" data-k="${esc(k)}"></label>`).join('')}
    </div>

    <div class="card pad stack" style="margin-top:14px">
      <div class="eyebrow">Barre & disques</div>
      <p class="muted" style="font-size:12px;margin:0">Sert au plate calculator pendant la séance.</p>
      <label class="field"><span>Poids de la barre (kg)</span><input class="num" inputmode="decimal" value="${s.barWeight}" data-action="barweight"></label>
      <label class="field"><span>Disques disponibles (kg, séparés par des virgules)</span><input class="num" value="${(s.plates || []).join(', ')}" data-action="plates-setting"></label>
    </div>

    <div class="card pad stack" style="margin-top:14px">
      <div class="eyebrow">Temps de repos (secondes)</div>
      <div class="row">
        <label class="field" style="flex:1"><span>Compounds</span><input class="num" inputmode="numeric" value="${s.restByRole.compound}" data-action="rest" data-k="compound"></label>
        <label class="field" style="flex:1"><span>Isolations</span><input class="num" inputmode="numeric" value="${s.restByRole.isolation}" data-action="rest" data-k="isolation"></label>
      </div>
    </div>

    <div class="card pad stack" style="margin-top:14px">
      <div class="eyebrow">Plans & rappels</div>
      <p class="muted" style="font-size:12px;margin:0">« Si [jour · heure], alors ta séance. » Le rappel s’accroche à ce moment — notification locale, aucun serveur.</p>
      ${(s.plans && s.plans.length) ? `<div style="display:flex;flex-direction:column;gap:8px">${s.plans.slice().sort((a, b) => a.day - b.day || a.time.localeCompare(b.time)).map(p => `<div class="plan-item"><div style="font-size:13px"><b>${DAY_NAMES[p.day]}</b> · <span class="num">${p.time}</span>${p.anchor ? ` · <span class="muted">${esc(p.anchor)}</span>` : ''}</div><button class="btn ghost sm danger" data-action="plan-remove" data-id="${esc(p.id)}">✕</button></div>`).join('')}</div>` : '<div class="muted" style="font-size:12px">Aucun plan pour l’instant.</div>'}
      <button class="btn block" data-action="add-plan">+ Ajouter un plan</button>
      <button class="btn block" data-action="enable-reminder">${(typeof Notification !== 'undefined' && Notification.permission === 'granted') ? 'Rappels activés ✓' : 'Activer les rappels'}</button>
    </div>

    <div class="card pad stack" style="margin-top:14px">
      <div class="eyebrow">Deload</div>
      <button class="btn block" data-action="apply-deload">Appliquer une semaine de deload (−40%)</button>
    </div>

    <div class="card pad stack" style="margin-top:14px">
      <div class="eyebrow">Données</div>
      <button class="btn block" data-action="export">Exporter mes données (JSON)</button>
      <button class="btn block" data-action="import">Importer une sauvegarde</button>
    </div>

    <div class="card pad stack" style="margin-top:14px">
      <div class="eyebrow">Labo · expérimental</div>
      <p class="muted" style="font-size:12px;margin:0">Coach Silencieux : compte tes reps par la caméra, 100 % sur l’appareil, rien n’est enregistré. Bêta.</p>
      <a class="btn block" href="./proto/coach-silencieux.html" style="text-decoration:none;display:flex;align-items:center;justify-content:center">Ouvrir le Coach Silencieux ▸</a>
    </div>

    <div class="card pad stack" style="margin-top:14px">
      <div class="eyebrow">Repas</div>
      <div class="empty" style="padding:12px"><div class="big">Bientôt disponible</div>Le suivi des repas arrivera dans une prochaine version.</div>
    </div>

    <div class="card pad stack" style="margin-top:14px">
      <div class="eyebrow">Version & mises à jour</div>
      <div class="between"><span class="num" style="font-weight:700">Version ${window.APP_VERSION || '—'}</span>
        <button class="btn ghost sm" data-action="check-updates">Vérifier les mises à jour</button></div>
      <p class="muted" style="font-size:12px;margin:0">L’app se met à jour toute seule à la réouverture. Ce bouton force la vérification. Tes données restent intactes.</p>
    </div>

    <button class="btn danger block" style="margin-top:18px" data-action="reset">Réinitialiser l’application</button>
    <p class="muted" style="font-size:11px;text-align:center;margin-top:18px">Chronographe · 100% local · aucune donnée ne quitte ton téléphone.</p>`;
  }

  // =====================================================================
  //  ÉDITEUR DE PROGRAMME (réordonner / ajouter / retirer / séries)
  // =====================================================================
  let progEdit = null; // templateId en cours d'édition
  function viewProgram() {
    const order = Store.currentOrder();
    if (!progEdit) {
      return `<div class="between" style="margin-bottom:12px"><h1 style="font-size:24px">Mon programme</h1><button class="btn ghost sm" data-nav="more">Retour</button></div>
      <p class="muted" style="font-size:13px;margin:0 0 14px">Programme : ${esc(Store.activeProgram().name)}. Touche une séance pour ajuster ses exercices et séries.</p>
      <div class="card">${order.map(t => `<div class="lib-item"><div style="flex:1"><div class="ex-title" style="font-size:15px">${esc(t.name)}</div><div class="ex-meta">${t.blocks.length} exercices · ${esc(t.focus)}</div></div><button class="btn ghost sm" data-action="edit-template" data-id="${t.id}">Éditer</button></div>`).join('')}</div>`;
    }
    const t = Store.templateById(progEdit);
    return `<div class="between" style="margin-bottom:12px"><h1 style="font-size:22px">${esc(t.name)}</h1><button class="btn ghost sm" data-action="prog-back">Séances</button></div>
    <div class="card">
      ${t.blocks.map((b, i) => { const ex = S().ex(b.exId); return `<div class="lib-item">
        <div style="display:flex;flex-direction:column;gap:2px">
          <button class="btn ghost sm" data-action="tpl-up" data-i="${i}" ${i === 0 ? 'disabled' : ''}>▲</button>
          <button class="btn ghost sm" data-action="tpl-down" data-i="${i}" ${i === t.blocks.length - 1 ? 'disabled' : ''}>▼</button>
        </div>
        <div style="flex:1;min-width:0"><div class="ex-title" style="font-size:14px">${esc(ex ? ex.name : b.exId)}</div><div class="ex-meta">${ex ? esc(ex.musclePrimary) : ''}</div></div>
        <div class="row" style="gap:4px"><button class="btn ghost sm" data-action="tpl-sets-minus" data-i="${i}">−</button><span class="num" style="min-width:48px;text-align:center">${b.sets} séries</span><button class="btn ghost sm" data-action="tpl-sets-plus" data-i="${i}">+</button></div>
        <button class="btn ghost sm danger" data-action="tpl-remove" data-i="${i}">✕</button>
      </div>`; }).join('')}
    </div>
    <button class="btn primary block" style="margin-top:14px" data-action="tpl-add">+ Ajouter un exercice</button>`;
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
    closeSheet(true);
    const bd = document.createElement('div');
    bd.className = 'sheet-backdrop'; bd.id = 'sheet';
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
  function closeSheet(silent) { const s = document.getElementById('sheet'); if (s) s.remove(); if (!silent) syncOverlayState(); }

  // Glisser la poignée vers le bas pour fermer (geste attendu sur mobile).
  function attachSwipeToClose(handle, sheet) {
    if (!handle || !sheet) return;
    let startY = null;
    handle.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; sheet.style.transition = 'none'; }, { passive: true });
    handle.addEventListener('touchmove', (e) => {
      if (startY == null) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0) sheet.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    handle.addEventListener('touchend', (e) => {
      if (startY == null) return;
      const dy = (e.changedTouches[0].clientY - startY);
      sheet.style.transition = ''; sheet.style.transform = '';
      if (dy > 70) closeSheet();
      startY = null;
    });
  }

  // Petit message éphémère (remplace les alertes système, trop brutales en PWA).
  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 2600);
  }

  // =====================================================================
  //  TIMER CHRONOGRAPHE (élément signature)
  // =====================================================================
  // Wake Lock : garde l'écran allumé pendant le repos (iOS 16.4+, Chrome…). Sans effet si non supporté.
  let wakeLock = null;
  async function requestWake() { try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {} }
  function releaseWake() { try { if (wakeLock) { wakeLock.release(); wakeLock = null; } } catch (e) {} }

  const R = 140, CIRC = 2 * Math.PI * R;
  function startTimer(seconds, exId) {
    stopTimer();
    requestWake();
    const ex = S().ex(exId);
    const cue = ex && ex.elbowSensitive
      ? `<div class="timer-cue"><b>Coude sensible</b> — contrôle la trajectoire, garde le coude fixe, pas de verrouillage forcé en extension.</div>`
      : `<div class="timer-cue">Respire, prépare la prochaine série.</div>`;
    const ov = document.createElement('div');
    ov.className = 'timer-sheet'; ov.id = 'timer';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Minuteur de repos');
    ov.innerHTML = `
      <div class="eyebrow" style="color:rgba(255,255,255,.6)">Repos${ex ? ' · ' + esc(ex.name) : ''}</div>
      <div class="dial" id="dial">
        <svg viewBox="0 0 320 320"><circle class="track" cx="160" cy="160" r="${R}"/><circle class="prog" id="prog" cx="160" cy="160" r="${R}" stroke-dasharray="${CIRC}" stroke-dashoffset="0"/></svg>
        <div class="readout"><div class="t num" id="t-read">0:00</div><div class="lbl">restant</div></div>
      </div>
      ${cue}
      <div class="timer-controls">
        <button class="btn" data-action="timer-add">+30 s</button>
        <button class="btn" data-action="timer-skip">Passer</button>
      </div>
      ${ex ? `<button class="btn timer-save" data-action="timer-save-rest">Mémoriser ce repos pour ${esc(ex.name)}</button>` : ''}`;
    document.body.appendChild(ov);
    syncOverlayState();
    timer = { total: seconds, remaining: seconds, exId };
    paintTimer();
    timer.interval = setInterval(() => {
      timer.remaining--;
      if (timer.remaining <= 0) { endTimer(); return; }
      paintTimer();
    }, 1000);
  }
  function paintTimer() {
    if (!timer) return;
    const m = Math.floor(timer.remaining / 60), s = timer.remaining % 60;
    const read = document.getElementById('t-read'); if (read) read.textContent = `${m}:${String(s).padStart(2, '0')}`;
    const prog = document.getElementById('prog'); const dial = document.getElementById('dial');
    const frac = timer.remaining / timer.total;
    if (prog) prog.setAttribute('stroke-dashoffset', String(CIRC * (1 - frac)));
    if (dial) dial.classList.toggle('ending', timer.remaining <= 10);
  }
  function endTimer() {
    if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
    try { if (Notification && Notification.permission === 'granted') new Notification('Repos terminé', { body: 'Prochaine série 💪', tag: 'rest', silent: false }); } catch (e) {}
    stopTimer();
  }
  function stopTimer() { if (timer && timer.interval) clearInterval(timer.interval); timer = null; releaseWake(); const t = document.getElementById('timer'); if (t) t.remove(); syncOverlayState(); }

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
      const sets = Array.from({ length: b.sets }, () => ({ weight: guessW ?? '', reps: '', rir: 2, done: false, type: 'normal' }));
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
    openRecap(recap, () => openCheckin(async (checkin) => {
      const session = {
        id: Date.now(), date: new Date().toISOString(), templateId: d.templateId, name: d.name, code: d.code,
        entries, cardio: d.cardio.done ? d.cardio : null, checkin, timeBudget: d.timeBudget, note: sessionNote || '',
      };
      await Store.saveSession(session);
      S().sessions.push(session);
      await Store.advanceRotation(d.templateId);
      await Store.clearDraft();
      closeSheet();
      go('home');
    }));
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
      .map(([m, n]) => `<span class="chip ok" style="font-size:11px">${esc(m)} ${n}</span>`).join(' ');
    openSheet(`<div class="grab"></div>
      <div class="view">
      <div class="eyebrow">Séance terminée</div>
      <h2 style="font-size:24px;margin:4px 0 14px">${esc(r.name)}, bouclé.</h2>
      <div class="recap-kpis">
        <div class="recap-kpi"><div class="v num">${r.volumeT >= 1 ? r.volumeT.toFixed(1) : r.volume}<span class="u">${r.volumeT >= 1 ? ' t' : ' kg'}</span></div><div class="k">Volume travaillé</div></div>
        <div class="recap-kpi"><div class="v num">${r.duration}<span class="u"> min</span></div><div class="k">Durée réelle</div></div>
        <div class="recap-kpi"><div class="v num">${r.workingSets}</div><div class="k">Séries de travail</div></div>
      </div>
      ${r.prs.length ? `<div class="banner volt" style="margin-top:12px"><div><div class="ttl">${r.prs.length} record${r.prs.length > 1 ? 's' : ''} battu${r.prs.length > 1 ? 's' : ''} 💥</div>${r.prs.map(p => `<div class="body">${esc(p.name)} · ${esc(p.label)}</div>`).join('')}</div></div>` : ''}
      ${muscleChips ? `<div class="card pad" style="margin-top:12px"><div class="eyebrow" style="margin-bottom:8px">Muscles touchés</div><div style="display:flex;gap:6px;flex-wrap:wrap">${muscleChips}</div></div>` : ''}
      ${r.cardio ? `<div class="ex-meta" style="margin-top:10px">Finisher · marche ${r.cardio.duration} min · ${r.cardio.incline}% · ${r.cardio.speed} km/h</div>` : ''}
      <label class="field" style="margin-top:14px"><span>Note de séance (optionnel)</span><textarea id="recap-note" rows="2" placeholder="Sensations, douleurs, énergie…"></textarea></label>
      <button class="btn primary block" style="margin-top:14px" data-action="recap-continue">Check-in fatigue ▸</button>
      </div>`);
    recapContinue = onContinue;
  }
  let recapContinue = null;
  let sessionNote = '';

  function openCheckin(cb) {
    const opt = (field, val, label) => `<button class="btn block" data-ck="${field}" data-v="${val}">${label}</button>`;
    let state = { energy: null, sleep: null };
    openSheet(`<div class="grab"></div>
      <h2>Check-in · 2 taps</h2>
      <p class="muted" style="font-size:13px;margin:4px 0 16px">Comment tu te sens ? Ça pilote les suggestions de repli, sans jugement.</p>
      <div class="eyebrow">Énergie</div>
      <div class="row" style="margin:8px 0 16px" id="ck-energy">${opt('energy', 1, '😮‍💨 Basse')}${opt('energy', 2, '🙂 Correcte')}${opt('energy', 3, '⚡ Top')}</div>
      <div class="eyebrow">Sommeil</div>
      <div class="row" style="margin:8px 0 16px" id="ck-sleep">${opt('sleep', 1, '😴 Court')}${opt('sleep', 2, '🛏️ Correct')}${opt('sleep', 3, '💤 Excellent')}</div>
      <button class="btn primary block" id="ck-done" disabled>Enregistrer la séance</button>
      <button class="btn ghost block" style="margin-top:8px" id="ck-skip">Passer le check-in</button>`);
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
    const nav = e.target.closest('[data-nav]'); if (nav) { if (nav.dataset.nav === 'program') progEdit = null; go(nav.dataset.nav); return; }
    const el = e.target.closest('[data-action]'); if (!el) return;
    const a = el.dataset.action;
    const d = S().draft;

    switch (a) {
      case 'close-sheet': closeSheet(); break;

      // ---- démarrage séance : sélecteur de temps ----
      case 'start-picker': {
        const t = Store.todayTemplate();
        openSheet(`<div class="grab"></div><h2>${esc(t.name)}</h2>
          <p class="muted" style="font-size:13px;margin:4px 0 16px">Combien de temps as-tu aujourd’hui ? Sous 60 min, je garde les compounds et coupe les isolations secondaires.</p>
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
          <p class="muted" style="font-size:13px;margin:4px 0 14px">La séance prévue se décale simplement d’un cran. La rotation reste cohérente ensuite.</p>
          ${Store.currentOrder().map(t => `<button class="btn block" style="margin-top:8px" data-action="bump" data-id="${t.id}">${esc(t.name)} · ${esc(t.focus)}</button>`).join('')}`);
        break;
      }
      case 'bump': { await Store.bumpToFront(el.dataset.id); closeSheet(); go('home'); break; }

      case 'abort': openSheet(`<div class="grab"></div><h2>Quitter la séance ?</h2><p class="muted" style="font-size:13px;margin:6px 0 16px">Ta progression n’est pas encore enregistrée. Tu peux reprendre plus tard depuis l’accueil, ou tout effacer.</p><button class="btn block" data-action="close-sheet">Reprendre plus tard</button><button class="btn danger block" style="margin-top:8px" data-action="abort-confirm">Abandonner la séance</button>`); break;
      case 'abort-confirm': await Store.clearDraft(); closeSheet(); go('home'); break;

      // ---- log de série ----
      case 'toggle-set': {
        const b = +el.dataset.b, s = +el.dataset.s; const set = d.blocks[b].sets[s];
        set.done = !set.done;
        if (set.done) {
          if (set.reps == null || set.reps === '') set.reps = S().ex(d.blocks[b].exId).repMin;
          const ex = S().ex(d.blocks[b].exId);
          const rest = Logic.restFor(ex);
          await Store.saveDraft(); render();
          startTimer(d.blocks[b].superset ? Math.round(rest * 0.6) : rest, ex.id);
          return;
        }
        await Store.saveDraft(); render(); break;
      }
      case 'add-set': { const b = +el.dataset.b; const last = d.blocks[b].sets[d.blocks[b].sets.length - 1]; d.blocks[b].sets.push({ weight: last ? last.weight : '', reps: '', rir: last ? last.rir : 2, done: false }); await Store.saveDraft(); render(); break; }
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
          <p class="muted" style="font-size:13px;margin:4px 0 12px">Ressenti, réglage de la machine, douleur, rappel technique…</p>
          <textarea id="exnote" rows="4">${esc(d.blocks[b].note || '')}</textarea>
          <button class="btn primary block" style="margin-top:12px" data-action="ex-note-save" data-b="${b}">Enregistrer la note</button>`);
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
      case 'lib-tab': libTab = el.dataset.tab; render(); break;
      case 'preview-session': openSessionPreview(el.dataset.id); break;
      case 'do-session': { await Store.bumpToFront(el.dataset.id); closeSheet(); go('home'); break; }
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
          <p class="muted" style="font-size:13px;margin:4px 0 14px">Même muscle (${esc(cur.musclePrimary)}), mouvement proche, autre matériel${cur.elbowSensitive ? ', coude-safe' : ''}.</p>
          ${alts.length ? alts.map(x => `<div class="sub-alt">${ILLU.svgFor(x.pattern, x.musclePrimary)}<div style="flex:1"><div class="ex-title" style="font-size:14px">${esc(x.name)}</div><div class="ex-meta">${esc(x.equipment)} · ${esc(x.musclePrimary)}</div></div><div style="display:flex;flex-direction:column;gap:6px"><button class="btn sm primary" data-action="sub-once" data-b="${b}" data-id="${x.id}">Cette séance</button><button class="btn sm steel" data-action="sub-perm" data-b="${b}" data-id="${x.id}">Définitif</button></div></div>`).join('') : '<div class="empty">Aucune alternative pertinente trouvée dans la bibliothèque.</div>'}`);
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
      case 'timer-add': if (timer) { timer.remaining += 30; timer.total += 30; paintTimer(); } break;
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
      case 'pattern-change': break; // géré dans onChange
      case 'save-exercise': await saveExerciseForm(el.dataset.id); break;
      case 'archive-exercise': { const ex = S().ex(el.dataset.id); ex.archived = !ex.archived; await Store.saveExercise(ex); closeSheet(); render(); break; }

      // ---- mode / réglages ----
      case 'mode': await Store.setMode(+el.dataset.mode); render(); break;
      case 'set-program': await Store.setProgram(el.dataset.id); closeSheet(); render(); break;
      case 'prog-detail': openProgramDetail(el.dataset.id); break;
      case 'enable-reminder': await enableReminder(); break;
      case 'export': await doExport(); break;
      case 'import': doImport(); break;
      case 'check-updates': await checkUpdates(); break;
      case 'reset': openSheet('<div class="grab"></div><h2>Réinitialiser ?</h2><p class="muted" style="font-size:13px;margin:6px 0 16px">Tout l’historique, le programme et les réglages seront effacés. Pense à exporter avant.</p><button class="btn block" data-action="close-sheet">Annuler</button><button class="btn danger block" style="margin-top:8px" data-action="reset-confirm">Tout effacer</button>'); break;
      case 'reset-confirm': { indexedDB.deleteDatabase('chrono-musculation'); location.reload(); break; }

      // ---- éditeur programme ----
      case 'edit-template': progEdit = el.dataset.id; render(); break;
      case 'prog-back': progEdit = null; render(); break;
      case 'tpl-up': case 'tpl-down': { const t = Store.templateById(progEdit); const i = +el.dataset.i; const j = a === 'tpl-up' ? i - 1 : i + 1; [t.blocks[i], t.blocks[j]] = [t.blocks[j], t.blocks[i]]; await Store.saveProgram(); render(); break; }
      case 'tpl-sets-plus': { const t = Store.templateById(progEdit); t.blocks[+el.dataset.i].sets++; await Store.saveProgram(); render(); break; }
      case 'tpl-sets-minus': { const t = Store.templateById(progEdit); const b = t.blocks[+el.dataset.i]; if (b.sets > 1) b.sets--; await Store.saveProgram(); render(); break; }
      case 'tpl-remove': { const t = Store.templateById(progEdit); t.blocks.splice(+el.dataset.i, 1); await Store.saveProgram(); render(); break; }
      case 'tpl-add': {
        const t = Store.templateById(progEdit);
        openSheet(`<h2>Ajouter à ${esc(t.name)}</h2>
          <input id="pick-q" placeholder="Rechercher un exercice ou un muscle…" data-action="pick-search" style="margin-top:12px">
          <div id="pick-list" style="margin-top:10px">${pickList('')}</div>`);
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
      case 'lib-search': libFilter = t.value; { const cur = document.activeElement; render(); const ni = app().querySelector('[data-action="lib-search"]'); if (ni) { ni.focus(); ni.setSelectionRange(ni.value.length, ni.value.length); } } break;
      case 'cardio-dur': d.cardio.duration = +t.value; document.getElementById('cardio-dur-val').textContent = t.value; await Store.saveDraft(); break;
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
      case 'pick-search': { const out = document.getElementById('pick-list'); if (out) out.innerHTML = pickList(t.value); break; }
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
  function startOnboarding() {
    onb = { step: 0, goal: null, experience: null, mode: 6, weight: '', planTime: '18:00',
      increments: { ...S().settings.increments }, planDays: [] };
    showOnboard();
  }
  function showOnboard() {
    let el = document.getElementById('onboard');
    if (!el) { el = document.createElement('div'); el.id = 'onboard'; el.className = 'onboard'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Configuration initiale'); document.body.appendChild(el); }
    el.innerHTML = onboardStep();
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
      body = `<div class="onb-seal">⏱️</div>
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
        <label class="field" style="margin-top:14px"><span>Poids de corps aujourd’hui (optionnel, kg)</span><input class="num" inputmode="decimal" data-action="onb-weight" value="${onb.weight}" placeholder="ex. 78"></label>
        ${nav('Continuer')}`;
    } else if (onb.step === 5) {
      body = `<div class="onb-eye">Ton plan</div><h2>Quand t’entraînes-tu ?</h2>
        <p class="onb-lead">Accrocher la séance à un moment fixe multiplie l’adhérence. Choisis tes jours et une heure.</p>
        <div class="onb-days">${DAY_NAMES.map((d, i) => `<button class="day-chip ${onb.planDays.includes(i) ? 'on' : ''}" data-action="onb-day" data-d="${i}">${d.slice(0, 3)}</button>`).join('')}</div>
        <label class="field" style="margin-top:14px"><span>Heure</span><input type="time" data-action="onb-time" value="${onb.planTime}"></label>
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
      <p class="muted" style="font-size:13px;margin:4px 0 14px">Tout reste en local. Le poids suffit ; les mensurations sont optionnelles.</p>
      <label class="field"><span>Poids de corps (kg)</span><input class="num" inputmode="decimal" id="bd-weight" value="${last && last.weight != null ? last.weight : ''}" placeholder="ex. 78.4"></label>
      <div class="row" style="margin-top:10px">
        <label class="field" style="flex:1"><span>Bras (cm)</span><input class="num" inputmode="decimal" id="bd-bras" value="${m.bras ?? ''}"></label>
        <label class="field" style="flex:1"><span>Poitrine (cm)</span><input class="num" inputmode="decimal" id="bd-poitrine" value="${m.poitrine ?? ''}"></label>
      </div>
      <div class="row" style="margin-top:10px">
        <label class="field" style="flex:1"><span>Taille (cm)</span><input class="num" inputmode="decimal" id="bd-taille" value="${m.taille ?? ''}"></label>
        <label class="field" style="flex:1"><span>Cuisse (cm)</span><input class="num" inputmode="decimal" id="bd-cuisse" value="${m.cuisse ?? ''}"></label>
      </div>
      <button class="btn primary block" style="margin-top:16px" data-action="body-save">Enregistrer la mesure</button>`);
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
      <p class="muted" style="font-size:13px;margin:4px 0 12px">« Si [jour · heure], alors ta séance. » Choisis les jours :</p>
      <div class="onb-days" id="plan-days">${DAY_NAMES.map((d, i) => `<button class="day-chip" data-action="plan-day-toggle" data-d="${i}">${d.slice(0, 3)}</button>`).join('')}</div>
      <label class="field" style="margin-top:12px"><span>Heure</span><input type="time" id="plan-time" value="18:00"></label>
      <label class="field" style="margin-top:10px"><span>Ancre (optionnel)</span><input id="plan-anchor" placeholder="ex. en sortant du boulot"></label>
      <button class="btn primary block" style="margin-top:16px" data-action="plan-create">Ajouter le plan</button>`);
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
