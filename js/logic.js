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

  function doneSets(entry) { return entry.sets.filter(s => s.done && (s.reps || 0) > 0); }

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
      for (const st of e.sets) { if (!st.done) continue; maxW = Math.max(maxW, st.weight || 0); maxVol = Math.max(maxVol, (st.weight || 0) * (st.reps || 0)); }
    }
    const curW = Math.max(...sets.map(s => s.done ? (s.weight || 0) : 0), 0);
    const curVol = Math.max(...sets.map(s => s.done ? (s.weight || 0) * (s.reps || 0) : 0), 0);
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
        const nDone = e.sets.filter(s => s.done && (s.reps || 0) > 0).length;
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

  window.Logic = {
    e1rm, roundToIncrement, startOfWeek, occurrences, lastOccurrence, doneSets,
    progression, stagnation, prForEntry, weeklyVolume, estimateMinutes, activeBlocks,
    recompose, substitutes, fatigueSuggests4Day, deloadStatus, regularityDays,
  };
})();
