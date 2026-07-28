/* store.js — Persistance IndexedDB + état applicatif en mémoire.
   Tout est local (aucun backend). On charge tout en mémoire au boot pour un rendu
   synchrone fluide, on persiste en asynchrone. Stores : exercises, sessions, meta. */
(function () {
  const DB_NAME = 'chrono-musculation';
  const DB_VERSION = 2;
  const PROGRAMS_VERSION = 2; // ↑ à incrémenter quand le contenu des programmes intégrés change

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('exercises')) db.createObjectStore('exercises', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('body')) db.createObjectStore('body', { keyPath: 'id' }); // v2 : suivi corporel
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  let db = null;
  function tx(store, mode) { return db.transaction(store, mode).objectStore(store); }
  function reqP(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  function getAll(store) { return reqP(tx(store, 'readonly').getAll()); }
  function put(store, val) { return reqP(tx(store, 'readwrite').put(val)); }
  function del(store, key) { return reqP(tx(store, 'readwrite').delete(key)); }
  function getMeta(key) { return reqP(tx('meta', 'readonly').get(key)); }
  function putMeta(key, value) { return put('meta', { key, value }); }

  // ---- État en mémoire (source de vérité pour le rendu) ----
  const State = {
    exercises: [],          // liste complète (base + custom), archived inclus
    sessions: [],           // historique loggé (ordre chrono croissant)
    settings: null,
    programs: {},           // bibliothèque : { programId -> séances éditables }
    draft: null,            // séance en cours (non persistée tant que non terminée)
  };

  function exMap() { const m = {}; State.exercises.forEach(e => m[e.id] = e); return m; }
  State.ex = (id) => State.exercises.find(e => e.id === id);

  function defaultSettings() {
    return {
      onboarded: false,
      profile: {},           // objectif, expérience, etc. (rempli à l'onboarding)
      plans: [],             // plans "si-alors" : [{ id, day, time, anchor }]
      programId: 'ppl6',     // programme actif dans la bibliothèque
      mode: 6,               // conservé pour la logique de repli fatigue (PPL↔U/L)
      restByRole: { compound: 150, isolation: 90 },
      increments: { 'haltère': 2, 'barre': 2.5, 'câble': 2.5, 'machine': 5, 'poids du corps': 1 },
      barWeight: 20,
      plates: [25, 20, 15, 10, 5, 2.5, 1.25],
      reminderTime: null,
      startDate: new Date().toISOString(),
      rotation: { queue: [], cyclePos: 0, programId: 'ppl6' },
      deload: { lastDeloadDate: new Date().toISOString(), active: false, activeUntil: null },
      cardioDefault: { duration: 25, incline: 8, speed: 5.5 },
    };
  }

  // Clone des templates de programme (blocks -> objets {exId,sets}) pour édition persistante.
  function seedProgram(src) {
    return src.map(t => ({
      id: t.id, name: t.name, code: t.code, focus: t.focus, note: t.note || '',
      droppedFromSixDay: t.droppedFromSixDay || null,
      blocks: t.blocks.map(([exId, sets]) => ({ exId, sets })),
    }));
  }

  function buildQueue(order, cyclePos, n = 8) {
    const q = [], ids = order.map(t => t.id);
    let p = cyclePos % ids.length;
    for (let i = 0; i < n; i++) { q.push(ids[p]); p = (p + 1) % ids.length; }
    return { queue: q, cyclePos: p };
  }

  async function load() {
    db = await openDB();
    let exs = await getAll('exercises');
    if (!exs.length) {
      // premier lancement : seed
      exs = DATA.BASE_EXERCISES.map(e => ({ ...e, custom: false, archived: false }));
      for (const e of exs) await put('exercises', e);
    }
    State.exercises = exs;

    State.sessions = (await getAll('sessions')).sort((a, b) => a.date.localeCompare(b.date));
    State.body = (await getAll('body')).sort((a, b) => a.date.localeCompare(b.date));

    let s = (await getMeta('settings'))?.value;
    const firstRun = !s;
    if (!s) { s = defaultSettings(); await putMeta('settings', s); }
    // migration douce des clés manquantes
    State.settings = Object.assign(defaultSettings(), s);
    // Utilisateur déjà installé (avant l'onboarding) : ne pas lui réimposer l'intro.
    if (!firstRun && s.onboarded === undefined) State.settings.onboarded = true;
    // Migration mode → programId pour les installations antérieures à la bibliothèque.
    if (!s.programId) State.settings.programId = State.settings.mode === 4 ? 'ul4' : 'ppl6';

    // Bibliothèque de programmes (éditable, persistée), versionnée pour recevoir les
    // mises à jour de contenu des programmes intégrés (nouveaux programmes, notes, exos).
    let progs = (await getMeta('programs'))?.value;
    const pv = (await getMeta('programsVersion'))?.value || 0;
    if (!progs || pv < PROGRAMS_VERSION) {
      progs = progs || {};
      if (!progs['ppl6']) { const o = (await getMeta('program6'))?.value; if (o) progs['ppl6'] = o; }
      if (!progs['ul4']) { const o = (await getMeta('program4'))?.value; if (o) progs['ul4'] = o; }
      for (const pr of DATA.PROGRAMS) progs[pr.id] = seedProgram(pr.sessions); // (re)seed intégrés à jour
      await putMeta('programs', progs);
      await putMeta('programsVersion', PROGRAMS_VERSION);
    }
    State.programs = progs;

    State.draft = (await getMeta('draft'))?.value || null;

    // init file d'attente rotation si vide ou programme incohérent
    const rot = State.settings.rotation;
    if (!rot.queue.length || rot.programId !== State.settings.programId) {
      const built = buildQueue(currentOrder(), rot.cyclePos || 0);
      rot.queue = built.queue; rot.cyclePos = built.cyclePos; rot.programId = State.settings.programId;
      await saveSettings();
    }
  }

  function currentOrder() { return State.programs[State.settings.programId] || State.programs['ppl6']; }
  function templateById(id) {
    const cur = currentOrder(); const t = cur.find(x => x.id === id); if (t) return t;
    for (const k in State.programs) { const f = State.programs[k].find(x => x.id === id); if (f) return f; }
    return null;
  }
  function activeProgram() { return DATA.PROGRAMS.find(p => p.id === State.settings.programId) || DATA.PROGRAMS[0]; }

  // ---- Persistance ----
  const saveSettings = () => putMeta('settings', State.settings);
  const saveProgram = () => putMeta('programs', State.programs);
  const saveExercise = (e) => put('exercises', e);
  const saveSession = (s) => put('sessions', s);
  const saveDraft = () => putMeta('draft', State.draft);
  const clearDraft = () => { State.draft = null; return putMeta('draft', null); };
  const saveBody = (entry) => put('body', entry);
  const deleteSession = (id) => del('sessions', id);

  // ---- Rotation (suit l’usage, pas le calendrier) ----
  function refillQueue() {
    const rot = State.settings.rotation, ids = currentOrder().map(t => t.id);
    while (rot.queue.length < 8) { rot.queue.push(ids[rot.cyclePos % ids.length]); rot.cyclePos = (rot.cyclePos + 1) % ids.length; }
  }
  function upcoming(n = 4) { refillQueue(); return State.settings.rotation.queue.slice(0, n).map(templateById); }
  function todayTemplate() { refillQueue(); return templateById(State.settings.rotation.queue[0]); }

  async function advanceRotation(doneTemplateId) {
    const rot = State.settings.rotation;
    const i = rot.queue.indexOf(doneTemplateId);
    if (i >= 0) rot.queue.splice(i, 1); else rot.queue.shift();
    refillQueue();
    await saveSettings();
  }

  // Réordonnancement ponctuel : "aujourd'hui je fais X" (la séance en tête se décale d'un cran).
  async function bumpToFront(templateId) {
    const rot = State.settings.rotation;
    const i = rot.queue.indexOf(templateId);
    if (i > 0) { rot.queue.splice(i, 1); rot.queue.unshift(templateId); }
    else if (i < 0) rot.queue.unshift(templateId);
    refillQueue(); await saveSettings();
  }

  async function rebuildRotation() {
    const rot = State.settings.rotation;
    const built = buildQueue(currentOrder(), 0);
    rot.queue = built.queue; rot.cyclePos = built.cyclePos; rot.programId = State.settings.programId;
    await saveSettings();
  }

  // Change de programme actif. Historique intact, rotation reconstruite, aucune donnée perdue.
  async function setProgram(id) {
    if (!State.programs[id] || State.settings.programId === id) return;
    State.settings.programId = id;
    const meta = DATA.PROGRAMS.find(p => p.id === id);
    State.settings.mode = id === 'ul4' ? 4 : id === 'ppl6' ? 6 : (meta ? meta.sessions.length : 6);
    await rebuildRotation();
    await saveSettings();
  }
  // Compat : la logique de repli fatigue bascule PPL(6) ↔ Upper/Lower(4).
  async function setMode(mode) { await setProgram(mode === 4 ? 'ul4' : 'ppl6'); }

  window.Store = {
    load, State, exMap, currentOrder, templateById, activeProgram,
    saveSettings, saveProgram, saveExercise, saveSession, saveDraft, clearDraft, saveBody, deleteSession,
    upcoming, todayTemplate, advanceRotation, bumpToFront, setMode, setProgram, rebuildRotation,
    // accès direct pour import/export
    _put: put, _getAll: getAll, _putMeta: putMeta,
  };
})();
