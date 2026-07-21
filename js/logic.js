/* logic.js — Toute la logique d’entraînement (pas de rendu ici).
   Double progression, stagnation, deload, volume hebdo, recompo au temps dispo,
   substitution, records, arrondi aux incréments disponibles. */
(function () {
  const S = () => Store.State;

  // ---------- utilitaires ----------
  const e1rm = (w, r) => (w || 0) * (1 + (r || 0) / 30);
  function round(v, step) { return Math.round(v / step) * step; }
  function roundToIncrement(weight, equipment) {
    const step = (S().settings.increments[equipment]) || 1;
    return +(round(weight, step)).toFixed(2);
  }
  function startOfWeek(d) {
    const x = new Date(d); const day = (x.getDay() + 6) % 7; // lundi=0
    x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - day); return x;
  }

  // ---------- occurrences historiques ----------
  function occurrences(exId) {
    const out = [];
    for (const sess of S().sessions) {
      const e = sess.entries.find(en => en.exId === exId);
      if (e && e.sets.some(st => st.done)) out.push({ date: sess.date, entry: e });
    }
    return out; // ordre chrono croissant
  }
  const lastOccurrence = (exId) => { const o = occurrences(exId); return o.length ? o[o.length - 1] : null; };

  // Séries "de travail" : validées, avec reps, et NON d'échauffement (l'échauffement
  // ne compte ni dans le volume, ni dans la progression, ni dans les records).
  function doneSets(entry) { return entry.sets.filter(s => s.done && (s.reps || 0) > 0 && s.type !== 'warm'); }

  // ---------- 4. Moteur de double progression ----------
  function progression(exId) {
    const ex = S().ex(exId); if (!ex) return null;
    const last = lastOccurrence(exId); if (!last) return null;
    const sets = doneSets(last.entry); if (!sets.length) return null;
    const topWeight = Math.max(...sets.map(s => s.weight || 0));
    const workingSets = sets.filter(s => (s.weight || 0) === topWeight);
    const allAtTop = workingSets.length >= sets.length && workingSets.every(s => (s.reps || 0) >= ex.repMax);
    if (allAtTop) {
      const suggested = roundToIncrement(topWeight + (S().settings.increments[ex.equipment] || 1), ex.equipment);
      return { type: 'load', from: topWeight, to: suggested, unit: 'kg',
        label: `Monte à ${suggested} kg — toutes les séries au sommet de la fourchette (${ex.repMax} reps).` };
    }
    const targetReps = Math.min(ex.repMax, (Math.min(...workingSets.map(s => s.reps || 0)) || ex.repMin) + 1);
    return { type: 'reps', weight: topWeight, to: targetReps,
      label: `Garde ${topWeight} kg, vise ${targetReps} reps (une de plus que la dernière fois).` };
  }

  // ---------- 5. Stagnation + ordre des leviers ----------
  function stagnation(exId) {
    const ex = S().ex(exId); if (!ex) return null;
    const occ = occurrences(exId).slice(-3);
    if (occ.length < 2) return null;
    const scores = occ.map(o => Math.max(...doneSets(o.entry).map(s => e1rm(s.weight, s.reps)), 0));
    const noProgress = scores.every((v, i) => i === 0 || v <= scores[0] + 0.01);
    if (!noProgress) return null;
    const sessionsStuck = occ.length;
    // Ordre imposé : d’abord baisser le RIR (surtout isolations), puis seulement ajouter une série.
    if (sessionsStuck < 3 || ex.role === 'isolation') {
      return { level: 'rir', label: 'Stagnation : rapproche-toi de l’échec — vise 1 RIR de moins avant d’ajouter du volume.' };
    }
    return { level: 'set', label: 'Stagnation persistante : le RIR ne suffit plus, ajoute une série à cet exercice.' };
  }

  // ---------- 21. Records personnels ----------
  function prForEntry(exId, sets, beforeDate) {
    let maxW = 0, maxVol = 0;
    for (const sess of S().sessions) {
      if (beforeDate && sess.date >= beforeDate) continue;
      const e = sess.entries.find(en => en.exId === exId); if (!e) continue;
      for (const st of e.sets) { if (!st.done || st.type === 'warm') continue; maxW = Math.max(maxW, st.weight || 0); maxVol = Math.max(maxVol, (st.weight || 0) * (st.reps || 0)); }
    }
    const work = sets.filter(s => s.done && s.type !== 'warm');
    const curW = Math.max(...work.map(s => s.weight || 0), 0);
    const curVol = Math.max(...work.map(s => (s.weight || 0) * (s.reps || 0)), 0);
    const badges = [];
    if (curW > maxW && curW > 0) badges.push({ kind: 'weight', value: curW, label: `Record de charge · ${curW} kg` });
    if (curVol > maxVol && curVol > 0) badges.push({ kind: 'volume', value: curVol, label: `Record de volume · ${curVol} kg×reps` });
    return badges;
  }

  // ---------- 6. Dashboard volume hebdomadaire ----------
  function weeklyVolume(refDate = new Date()) {
    const wk = startOfWeek(refDate).getTime();
    const counts = {}; DATA.MUSCLE_GROUPS.forEach(m => counts[m] = 0);
    for (const sess of S().sessions) {
      if (startOfWeek(new Date(sess.date)).getTime() !== wk) continue;
      for (const e of sess.entries) {
        const ex = S().ex(e.exId); if (!ex) continue;
        const nDone = e.sets.filter(s => s.done && (s.reps || 0) > 0 && s.type !== 'warm').length;
        if (counts[ex.musclePrimary] != null) counts[ex.musclePrimary] += nDone;
      }
    }
    return DATA.MUSCLE_GROUPS.map(m => {
      const sets = counts[m];
      let zone = 'low';                       // < zone réaliste
      if (sets >= 12 && sets <= 18) zone = 'ok';       // zone réaliste (déficit)
      else if (sets > 18 && sets <= 20) zone = 'high';  // haut de fourchette
      else if (sets > 20) zone = 'over';               // rendement décroissant
      else if (sets >= 8) zone = 'building';
      return { muscle: m, sets, zone };
    });
  }

  // ---------- durée + 15. recompo au temps disponible ----------
  function blockMinutes(role, sets) { return sets * ((S().settings.restByRole[role] || 120) + 40) / 60; }
  function estimateMinutes(blocks) {
    let t = 5; // échauffement
    for (const b of blocks) { const ex = S().ex(b.exId); if (ex) t += blockMinutes(ex.role, b.sets); }
    return Math.round(t);
  }
  // Génère les blocs actifs d’un template (deload appliqué, exercices archivés retirés).
  function activeBlocks(template) {
    const dl = S().settings.deload;
    const deloadOn = dl.active && dl.activeUntil && Date.now() < new Date(dl.activeUntil).getTime();
    return template.blocks
      .map(b => { const ex = S().ex(b.exId); return ex && !ex.archived ? { exId: b.exId, sets: deloadOn ? Math.max(1, Math.round(b.sets * 0.6)) : b.sets } : null; })
      .filter(Boolean);
  }
  // Recompose pour tenir dans le budget : coupe les isolations d’abord, jamais les compounds.
  function recompose(blocks, budgetMin) {
    let cur = blocks.map(b => ({ ...b }));
    const dropped = [];
    const isoIdx = () => cur.map((b, i) => ({ i, role: S().ex(b.exId)?.role })).filter(x => x.role === 'isolation').map(x => x.i);
    while (estimateMinutes(cur) > budgetMin) {
      const iso = isoIdx();
      if (iso.length) { const i = iso[iso.length - 1]; dropped.push(S().ex(cur[i].exId)?.name); cur.splice(i, 1); continue; }
      // plus que des compounds : réduire les séries (jamais en dessous de 2), sinon stop
      let reduced = false;
      for (let i = cur.length - 1; i >= 1; i--) { if (cur[i].sets > 2) { cur[i].sets--; reduced = true; break; } }
      if (!reduced) break;
    }
    return { blocks: cur, dropped: dropped.filter(Boolean) };
  }

  // ---------- 2. Substitution intelligente ----------
  const FAMILY = { 'push-h': 'push', 'push-v': 'push', 'pull-h': 'pull', 'pull-v': 'pull', 'squat': 'legs', 'hinge': 'legs' };
  function substitutes(exId) {
    const src = S().ex(exId); if (!src) return [];
    const needElbowSafe = !!(src.elbowSensitive || src.elbowUnsafe);
    const cands = S().exercises.filter(e =>
      e.id !== exId && !e.archived && !e.elbowUnsafe &&
      (!needElbowSafe || !e.elbowUnsafe) &&
      (e.musclePrimary === src.musclePrimary || (e.muscleSecondary || []).includes(src.musclePrimary)));
    const scored = cands.map(e => {
      let sc = 0;
      if (e.musclePrimary === src.musclePrimary) sc += 4;
      if (e.pattern === src.pattern) sc += 3;
      else if (FAMILY[e.pattern] && FAMILY[e.pattern] === FAMILY[src.pattern]) sc += 1;
      if (e.equipment !== src.equipment) sc += 2; // "équipement différent de celui en cours"
      if (e.role === src.role) sc += 1;
      return { ex: e, score: sc };
    }).filter(x => x.score > 0);
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 3).map(x => x.ex);
  }

  // ---------- 7. Check-in fatigue → proposer 4 jours ----------
  function fatigueSuggests4Day() {
    if (S().settings.mode === 4) return false;
    const withCk = S().sessions.filter(s => s.checkin);
    const last2 = withCk.slice(-2);
    if (last2.length < 2) return false;
    // check-in "faible" : énergie ou sommeil = 1 (bas)
    const weak = (c) => c.energy === 1 || c.sleep === 1;
    // consécutifs sur une semaine
    const within = new Date(last2[1].date) - new Date(last2[0].date) <= 7 * 864e5;
    return within && last2.every(s => weak(s.checkin));
  }

  // ---------- 9. Deload ----------
  function deloadStatus() {
    const dl = S().settings.deload;
    const weeks = Math.floor((Date.now() - new Date(dl.lastDeloadDate).getTime()) / (7 * 864e5));
    const active = dl.active && dl.activeUntil && Date.now() < new Date(dl.activeUntil).getTime();
    return { weeks, due: weeks >= 5 && !active, active };
  }

  // ---------- 17/18. régularité (4 dernières semaines) ----------
  function regularityDays(weeks = 4) {
    const done = new Set(S().sessions.map(s => new Date(s.date).toDateString()));
    const out = []; const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = weeks * 7 - 1; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      out.push({ date: d, done: done.has(d.toDateString()) });
    }
    return out;
  }

  // ---------- Plate calculator : décompose une charge en disques par côté ----------
  function plateCalc(target, equipment) {
    if (equipment !== 'barre') return null;
    const bar = S().settings.barWeight || 20;
    const plates = (S().settings.plates || [25, 20, 15, 10, 5, 2.5, 1.25]).slice().sort((a, b) => b - a);
    let perSide = (target - bar) / 2;
    if (perSide < 0) return { bar, target, ok: false, tooLight: true, perSide: [] };
    const out = [];
    for (const p of plates) {
      const n = Math.floor(perSide / p + 1e-6);
      if (n > 0) { out.push({ plate: p, count: n }); perSide = +(perSide - n * p).toFixed(3); }
    }
    const loaded = bar + 2 * out.reduce((a, x) => a + x.plate * x.count, 0);
    return { bar, target, perSide: out, ok: Math.abs(loaded - target) < 0.01, loaded };
  }

  // ---------- Générateur de séries d'échauffement (ramp vers la charge de travail) ----------
  function warmupSets(workingWeight, equipment) {
    if (!workingWeight || workingWeight <= 0) return [];
    const pcts = [[0.5, 8], [0.7, 5], [0.85, 3]];
    const seen = new Set();
    const out = [];
    for (const [p, reps] of pcts) {
      const w = roundToIncrement(workingWeight * p, equipment);
      if (w > 0 && w < workingWeight && !seen.has(w)) { seen.add(w); out.push({ weight: w, reps, rir: null, done: false, type: 'warm' }); }
    }
    return out;
  }

  // ---------- Séries temporelles pour les graphes de progression ----------
  function e1rmSeries(exId) {
    return occurrences(exId).map(o => {
      const sets = doneSets(o.entry);
      if (!sets.length) return null;
      let best = sets[0];
      for (const s of sets) if (e1rm(s.weight, s.reps) > e1rm(best.weight, best.reps)) best = s;
      return { date: o.date, value: +e1rm(best.weight, best.reps).toFixed(1), top: { weight: best.weight, reps: best.reps },
        volume: sets.reduce((a, s) => a + (s.weight || 0) * (s.reps || 0), 0) };
    }).filter(Boolean);
  }

  // Exercices déjà loggés (pour la liste de l'onglet Progrès), triés par récence.
  function loggedExercises() {
    const last = {};
    for (const sess of S().sessions) for (const e of sess.entries)
      if (e.sets.some(s => s.done && s.type !== 'warm')) last[e.exId] = sess.date;
    return Object.keys(last).map(id => ({ id, date: last[id], ex: S().ex(id) }))
      .filter(x => x.ex).sort((a, b) => b.date.localeCompare(a.date));
  }

  window.Logic = {
    e1rm, roundToIncrement, startOfWeek, occurrences, lastOccurrence, doneSets,
    progression, stagnation, prForEntry, weeklyVolume, estimateMinutes, activeBlocks,
    recompose, substitutes, fatigueSuggests4Day, deloadStatus, regularityDays,
    plateCalc, warmupSets, e1rmSeries, loggedExercises,
  };
})();
