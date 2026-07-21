/* store.js — Persistance IndexedDB + état applicatif en mémoire.
   Tout est local (aucun backend). On charge tout en mémoire au boot pour un rendu
   synchrone fluide, on persiste en asynchrone. Stores : exercises, sessions, meta. */
(function () {
  const DB_NAME = 'chrono-musculation';
  const DB_VERSION = 2;

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
  function getMeta(key) { return reqP(tx('meta', 'readonly').get(key)); }
  function putMeta(key, value) { return put('meta', { key, value }); }

  // ---- État en mémoire (source de vérité pour le rendu) ----
  const State = {
    exercises: [],          // liste complète (base + custom), archived inclus
    sessions: [],           // historique loggé (ordre chrono croissant)
    settings: null,
    program: { 6: null, 4: null }, // templates éditables par mode
    draft: null,            // séance en cours (non persistée tant que non terminée)
  };

  function exMap() { const m = {}; State.exercises.forEach(e => m[e.id] = e); return m; }
  State.ex = (id) => State.exercises.find(e => e.id === id);

  function defaultSettings() {
    return {
      onboarded: false,
      profile: {},           // objectif, expérience, etc. (rempli à l'onboarding)
      plans: [],             // plans "si-alors" : [{ id, day, time, anchor }]
      mode: 6,
      restByRole: { compound: 150, isolation: 90 },
      increments: { 'haltère': 2, 'barre': 2.5, 'câble': 2.5, 'machine': 5, 'poids du corps': 1 },
      barWeight: 20,
      plates: [25, 20, 15, 10, 5, 2.5, 1.25],
      reminderTime: null,
      startDate: new Date().toISOString(),
      rotation: { queue: [], cyclePos: 0, mode: 6 },
      deload: { lastDeloadDate: new Date().toISOString(), active: false, activeUntil: null },
      cardioDefault: { duration: 25, incline: 8, speed: 5.5 },
    };
  }

  // Clone des templates de programme (blocks -> objets {exId,sets}) pour édition persistante.
  function seedProgram(src) {
    return src.map(t => ({
      id: t.id, name: t.name, code: t.code, focus: t.focus,
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

    let p6 = (await getMeta('program6'))?.value;
    if (!p6) { p6 = seedProgram(DATA.PROGRAM_6); await putMeta('program6', p6); }
    let p4 = (await getMeta('program4'))?.value;
    if (!p4) { p4 = seedProgram(DATA.PROGRAM_4); await putMeta('program4', p4); }
    State.program[6] = p6; State.program[4] = p4;

    State.draft = (await getMeta('draft'))?.value || null;

    // init file d'attente rotation si vide ou mode incohérent
    const rot = State.settings.rotation;
    if (!rot.queue.length || rot.mode !== State.settings.mode) {
      const built = buildQueue(currentOrder(), rot.cyclePos || 0);
      rot.queue = built.queue; rot.cyclePos = built.cyclePos; rot.mode = State.settings.mode;
      await saveSettings();
    }
  }

  function currentOrder() { return State.program[State.settings.mode]; }
  function templateById(id) { return currentOrder().find(t => t.id === id) || State.program[6].find(t => t.id === id) || State.program[4].find(t => t.id === id); }

  // ---- Persistance ----
  const saveSettings = () => putMeta('settings', State.settings);
  const saveProgram = () => Promise.all([putMeta('program6', State.program[6]), putMeta('program4', State.program[4])]);
  const saveExercise = (e) => put('exercises', e);
  const saveSession = (s) => put('sessions', s);
  const saveDraft = () => putMeta('draft', State.draft);
  const clearDraft = () => { State.draft = null; return putMeta('draft', null); };
  const saveBody = (entry) => put('body', entry);

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

  async function rebuildRotationForMode() {
    const rot = State.settings.rotation;
    const built = buildQueue(currentOrder(), 0);
    rot.queue = built.queue; rot.cyclePos = built.cyclePos; rot.mode = State.settings.mode;
    await saveSettings();
  }

  async function setMode(mode) {
    if (State.settings.mode === mode) return;
    State.settings.mode = mode;
    await rebuildRotationForMode(); // historique intact, aucune donnée perdue
    await saveSettings();
  }

  window.Store = {
    load, State, exMap, currentOrder, templateById,
    saveSettings, saveProgram, saveExercise, saveSession, saveDraft, clearDraft, saveBody,
    upcoming, todayTemplate, advanceRotation, bumpToFront, setMode, rebuildRotationForMode,
    // accès direct pour import/export
    _put: put, _getAll: getAll, _putMeta: putMeta,
  };
})();
