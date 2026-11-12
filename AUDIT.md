# AUDIT — Chronographe (état au v15)

> Document de passation pour la **refonte graphique complète + système d'animations**.
> Il décrit précisément ce qui existe, ce qui doit être préservé, ce qui est fragile, et ce que la refonte doit viser.
> Branche de travail : `claude/document-review-application-6zxa5n` · PR ouverte : #1 (base `main`).
> App en ligne : https://rostoms.github.io/PWA-sport-app/ (GitHub Pages sert cette branche).

---

## 0. TL;DR

- **Quoi** : PWA de musculation 100 % locale (IndexedDB, hors-ligne, installable iPhone), programme PPL A/B 6 j par défaut + 6 autres programmes, progression double, volume hebdo, deload, chrono de repos « cadran ».
- **Stack** : HTML/CSS/JS vanilla, aucun build, aucune dépendance. Scripts classiques chargés dans l'ordre, globals `window.*`.
- **Taille** : ~3 250 lignes. `js/ui.js` = **1 562 lignes** (le monolithe à surveiller). `css/app.css` = 384 lignes (denses).
- **Qualité fonctionnelle** : bonne, 18/18 tests Playwright au v15. **Qualité visuelle** : propre mais sage ; animations quasi absentes ; ~**207 `style="…"` inline** dans `ui.js` → c'est la dette n°1 pour une refonte.
- **Règle d'or de la refonte** : changer la peau et le mouvement, **pas** les hooks (`data-action`, `data-nav`, `data-*`, ids), ni le modèle de données, ni le service worker.

---

## 1. Produit

### 1.1 Promesse
Coach de muscu silencieux : « ouvre, fais ta séance, l'app te dit quoi charger ». Zéro compte, zéro serveur, zéro pub. Contrainte santé de l'utilisateur : **valgus du coude** → exos à barre droite/EZ en supination contre-indiqués (`elbowUnsafe` + `replaceWith`), rappel « coude » pendant le repos.

### 1.2 Onglets (tab bar, 5)
| Route | Libellé | Contenu |
|---|---|---|
| `home` | Aujourd'hui | Hero séance du jour (nom, code, durée estimée, muscles), bannières (deload, fatigue, plans « si-alors »), carte « À suivre » (tap → prévisualisation), mini-bande de régularité, bouton Démarrer / Choisir une autre séance |
| `train` | Programme | Segments **Mon programme** (programme actif + « pourquoi » dépliable + bibliothèque de 7 programmes + programmes perso) · **Séances** (regroupées par type, prévisualisation complète) · **Exercices** (bibliothèque filtrable, créer/éditer/archiver) |
| `volume` | Volume | Muscle-map SVG face/dos colorée par zone + barres de séries/semaine par groupe (zones MEV/MAV/MRV) |
| `progress` | Progrès | Régularité + bande de constance, Corps (poids/mesures), calibration RIR, outils (1RM & %), sparklines par exercice, records, historique (tap → détail/suppression) |
| `more` | Réglages | Incréments, barre & disques, repos par rôle, plans & rappels, deload, export/import JSON, Labo, version + « Vérifier les mises à jour », reset |

Routes hors tab bar : `session` (séance en cours), `program` (éditeur « Mes séances »).

### 1.3 Séance en cours (`viewSession`) — l'écran le plus important
- Note « pourquoi cet ordre » (`<details class="why">`).
- Cartes exercice ordonnées : illustration SVG, consigne, charge suggérée + delta vs dernière fois, **lignes de séries** (grille `38px 1fr 1fr 1fr 44px` : type · kg · reps · RIR · ✓).
- Type de série cyclable au tap : W (échauffement) / D (dégressive) / E (échec) / A (normale).
- Actions par carte : ▲▼ réordonner, échauffement auto, calcul de disques, superset, 📝 note, « Machine prise » → substitution (une fois / définitive), progression de l'exo.
- Validation d'une série → animation `stamp` + **chrono de repos** plein écran.
- Finisher cardio optionnel (durée, vitesse, inclinaison).
- Fin → **récap** (KPIs, PRs) → check-in (ressenti) → persistance. Brouillon auto-sauvé (`meta.draft`) : reprise si l'app est tuée.

### 1.4 Chrono de repos (signature visuelle)
Overlay avec **cadran de chronographe** (SVG, arc qui se vide), temps en mono tabulaire, +30 s, Passer, « Mémoriser ce repos » (repos par exercice), rappel coude, Wake Lock pour garder l'écran allumé, vibration en fin si dispo.

### 1.5 Feuilles (bottom sheets)
`openSheet(html)` → `.sheet` dans `#sheet-bd` (ajouté au `body`). En-tête collant `.sheet-head` (poignée + ✕ `.sheet-close`), swipe-down pour fermer, Échap, clic fond, verrouillage du scroll (`body{position:fixed}`), `aria-hidden` sur `#app`/`#tabbar`. Utilisées pour : prévisualisation séance, détail programme (chips de couverture musculaire), progression exo, 1RM, disques, corps, plans, détail séance passée, pickers, confirmations.

### 1.6 Onboarding (6 étapes)
Jours/semaine → durée → poids de corps → incréments → … → choix programme. Plein écran, `onb-*` actions, « Passer » possible.

### 1.7 Labo
`proto/coach-silencieux.html` : compteur de reps par caméra (différence d'images, seuil de bruit adaptatif, objectif de reps, journal). **Bêta, isolé**. Un vrai modèle de pose (MediaPipe/MoveNet) n'a pas pu être intégré : CDNs bloqués dans l'environnement de dev.

---

## 2. Architecture

### 2.1 Fichiers
```
index.html            shell : #boot (spinner), #app, #tabbar ; charge les scripts dans l'ordre
manifest.json         "Chronographe — Musculation", standalone, theme #2B3A67, icônes 192/512
sw.js                 service worker (CACHE 'chrono-v15')
reset-sw.html         page de secours : désinscrit le SW + vide les caches, NE touche PAS IndexedDB
css/app.css           tout le style (tokens, composants, keyframes, dark mode, reduced-motion)
js/data.js            window.DATA : exercices (~50), 7 programmes, groupes musculaires
js/illustrations.js   window.ILLU.svgFor(pattern, muscle) → SVG par pattern de mouvement
js/store.js           window.Store : IndexedDB + état mémoire + rotation + programmes
js/logic.js           window.Logic : toute la science d'entraînement (pur, sans DOM)
js/ui.js              window.UI : routes, vues (template strings), délégation d'événements, sheets, timer, onboarding
js/app.js             APP_VERSION='15', enregistrement SW + reload sur controllerchange, Store.load(), UI.init()
proto/coach-silencieux.html   prototype caméra
DESIGN.md / README.md / tools/gen_icons.py / icons/*.png
```

### 2.2 Modèle de rendu (important pour les animations)
- `go(route)` → `render()` → **`app().innerHTML = <div class="view">topbar + vue</div>`** : chaque navigation et la plupart des actions **re-rendent toute la vue**. Conséquences :
  - pas de transitions entre états d'un même écran (le DOM est remplacé) ;
  - l'animation d'entrée `riseIn` sur `.view` rejoue à chaque re-render ;
  - le focus et la position de scroll sont perdus (scroll remis à 0 sur `go`).
- Événements : **délégation** `click`/`input`/`change` sur `document` → `switch (data-action)`. Rien n'est lié aux nœuds, donc on peut changer tout le markup tant que les attributs restent.
- Mises à jour partielles déjà existantes (à réutiliser comme modèle) : `#pick-list`, `#plate-out`, `#orm-out`, `#form-illu` (innerHTML ciblé).
- Gardes anti-régression : `lastPickQuery` / `libFilter` — ne re-rendre que si la requête a changé (sinon blur→change détruit la cible du clic).

### 2.3 Hooks à NE PAS casser
`data-nav` : `home program progress session train`.
`data-action` (≈95) : `abort abort-confirm add-plan add-set apply-deload archive-exercise barweight body-add body-save bump cardio-dur cardio-incline cardio-speed check-updates close-sheet cycle-type del-set dismiss-deload dismiss-fatigue do-session edit-exercise edit-template enable-reminder ex-note ex-note-save ex-progress export finish import increment lib-search lib-tab move-ex new-exercise onb-back onb-day onb-inc onb-skip onb-time onb-weight one-rm one-rm-ex orm pattern-change pick-search plan-create plan-day-toggle plan-remove plate-target plates plates-setting preview-session prog-back prog-create prog-create-do prog-delete prog-delete-do prog-detail prog-edit recap-continue reorder reset reset-confirm rest save-exercise session-delete session-detail set-program start start-picker sub-once sub-perm substitute superset timer-add timer-save-rest timer-skip toggle-cardio toggle-set tpl-add tpl-add-do tpl-del tpl-del-do tpl-down tpl-dup tpl-new tpl-new-do tpl-remove tpl-rename tpl-rename-do tpl-sets-minus tpl-sets-plus tpl-up warmup`.
Plus les attributs de contexte (`data-ex`, `data-i`, `data-id`, `data-tab`, `data-dir`, …) et les ids ciblés (`pick-list`, `plate-out`, `orm-out`, `orm-w`, `orm-r`, `orm-eq`, `form-illu`, `boot`, `app`, `tabbar`).
→ Avant de livrer : `grep -o 'data-action="[^"]*"'` avant/après doit donner la même liste.

---

## 3. Données (IndexedDB `chrono-musculation`, DB_VERSION = 2)

| Store | Contenu |
|---|---|
| `exercises` | exercices de base seedés + perso (`{id,name,muscle,pattern,equip,role,elbowUnsafe?,replaceWith?,archived?,…}`) |
| `sessions` | séances terminées (`{id,date,templateId,entries:[{exId,sets:[{w,r,rir,type,done}],note}],cardio?,checkin?,duration}`) |
| `meta` | `settings`, `programs` (bibliothèque par programId), `programsVersion`, `draft` (séance en cours), legacy `program6`/`program4` |
| `body` | mesures corporelles (poids, tours) |

`settings` : `onboarded, profile, plans, programId, customPrograms, mode, restByRole, increments, barWeight, plates, rotation{queue,cyclePos,programId}, deload{lastDeloadDate,active,activeUntil,snoozeUntil}, cardioDefault`.
Programme : `{id,name,days,mode,desc,rationale,sessions,special?}` ; séance : `{id,name,code,focus,note,blocks:[[exId,sets]]}`.
Rotation **à l'usage** (file + `cyclePos`), `bumpToFront` quand on choisit une autre séance.
`PROGRAMS_VERSION = 2` : un bump re-seed les programmes intégrés (**écrase les modifs faites sur un programme intégré** — dette connue).

---

## 4. Logique d'entraînement (`logic.js`, pure)
e1RM (Epley) · arrondi à l'incrément · double progression · stagnation (baisse RIR avant volume) · PR par entrée · volume hebdo par muscle (séries effectives, échauffements exclus) · estimation durée · recomposition selon budget temps (`activeBlocks`/`recompose`) · substitutions · suggestion passage 4 j si fatigue (ppl6 uniquement) · statut deload (5 semaines, snooze 7 j) · jours de régularité · `restFor` (repos par exo > par rôle) · calcul de disques · génération d'échauffement · séries e1RM · bande de constance · stats corps · calibration RIR.
**Aucune de ces fonctions ne touche le DOM → hors périmètre de la refonte.**

---

## 5. Design system actuel « Chronographe affiné »

### 5.1 Tokens (`:root`)
```
--ink #16181F  --ink-2 #3A3F4B  --muted #6B7280
--paper #EDF0F4  --card #FFFFFF  --line #DCE1E8
--steel #2B3A67 (fonds profonds, reste sombre en dark)  --accent-steel (texte, s'éclaircit en dark)
--signal #3D5AFE / --signal-ink #1E36C8   (action primaire)
--volt #C6F135 / --volt-ink #4C5E00       (RÉSERVÉ aux PRs)
--amber #FF9E2C / --amber-ink #8A4B00     (avertissements, deload)
--danger #E23D3D
--r-lg 22 / --r-md 15 / --r-sm 10 ; --shadow, --shadow-lg
--sans: pile système (SF Pro sur iOS) ; --mono: ui-monospace/SF Mono (chiffres tabulaires)
--safe-t / --safe-b : safe areas iOS
```
Dark mode via `prefers-color-scheme` (pas de toggle manuel).

### 5.2 Composants existants
hero, upnext, banners, ex-card, set-row + `.sidx` (types), dial (chrono), vol bars, muscle-map, cal (régularité), sheet / sheet-head / sheet-close, toast, onboarding, prog-pick, seg2 (segments), why, plate visual, recap kpis, orm table, mv (▲▼), timer-save, ex-note-line, chips.

### 5.3 Animations actuelles (le maigre inventaire)
| Keyframe | Usage | Limite |
|---|---|---|
| `riseIn` | entrée de `.view` | rejoue à chaque re-render, même pour un simple toggle |
| `stamp` | ✓ d'une série validée | seul vrai « moment » de feedback |
| `toastIn/Out` | toasts | ok |
| `sweepIn` | fondu générique | peu utilisé |
| `spin` | boot | — |
| `shake` | erreur de saisie | — |
| transition `.sheet` | montée/descente | pas de spring, pas de suivi du doigt fluide |
Bloc `prefers-reduced-motion` présent (à conserver et étendre).

**Absents** : transitions entre onglets, entre segments, entre étapes d'onboarding ; feedback sur la tab bar ; décompte/arc du cadran animé finement ; célébration de PR ; apparition échelonnée des listes ; morph carte → séance ; compteurs qui « roulent » ; états pressés (`:active`) cohérents ; haptique (limité sur iOS Safari).

---

## 6. Dette & fragilités (classées)

1. **Styles inline massifs** (~207 `style="…"` dans `ui.js`) → impossibles à thématiser/animer proprement. À migrer en classes.
2. **Re-render total** (`innerHTML` de toute la vue) → bloque les transitions d'état. Piste sans framework : rendre la vue dans un fragment et ne remplacer que les sections changées, ou utiliser la **View Transitions API** (`document.startViewTransition`, Safari iOS 18+) avec fallback instantané.
3. **`ui.js` monolithe** (1 562 l.) : vues + événements + sheets + timer + onboarding mélangés. Découpage possible en `ui/*.js` (scripts classiques, ordre de chargement) — à ajouter dans `sw.js` ASSETS.
4. Programmes intégrés écrasés au bump de `PROGRAMS_VERSION`.
5. Pas de toggle thème manuel ; tokens dark partiellement dupliqués.
6. `.grab` dupliqués dans certaines sheets (masqués en CSS) — nettoyage.
7. iOS PWA : pas de vraie notification de fin de repos en arrière-plan ; vibration non supportée sur iOS ; Wake Lock seulement iOS 16.4+.
8. Illustrations SVG génériques par pattern (10 patterns) — fonctionnelles mais basiques : candidates à une refonte de style cohérente.
9. Pas de tests versionnés (Playwright lancé à la volée, non commité).

---

## 7. Release & tests (process actuel — à suivre à la lettre)

1. Bumper **`CACHE`** dans `sw.js` (`chrono-vN`) **et** `APP_VERSION` dans `js/app.js`.
2. Ajouter tout nouveau fichier JS/CSS à `ASSETS` dans `sw.js`.
3. Tester (Playwright, mobile `hasTouch/isMobile`, ~390×844) :
   ```
   npm i -D playwright@1.61.1
   NODE_PATH=$PWD/node_modules node test.js   # serveur http local dans le script
   # chromium : /opt/pw-browsers/chromium-1194/chrome-linux/chrome
   ```
   Parcours minimum : onboarding → home → démarrer séance → valider série → chrono → finir → récap ; chaque onglet ; ouvrir/fermer chaque sheet (✕, swipe, Échap) ; dark mode ; reduced-motion ; aucune erreur console.
4. `rm -rf node_modules package.json package-lock.json` **avant** commit.
5. Push sur `claude/document-review-application-6zxa5n` → Pages redéploie (~1 min). Sur le téléphone : rouvrir l'app (network-first + reload auto), sinon `…/reset-sw.html` (données conservées).

---

## 8. Backlog fonctionnel restant
- Option **RPE** à côté du RIR.
- **Superset guidé** A→B (alternance + repos unique).
- kg/lb ; import CSV (Strong/Hevy) ; vrai modèle de pose (bloqué ici par le réseau).
- Programmes intégrés éditables sans être écrasés (copie-sur-écriture).

---

## 9. BRIEF DE REFONTE GRAPHIQUE (pour le prochain modèle + skill « unslop »)

### 9.1 Objectif
Une identité **forte, mémorable, non générique** autour de la métaphore *chronographe / instrument de précision*, et un **système de mouvement** cohérent qui rend l'app agréable sous la sueur : gros, lisible, rapide, physique.

### 9.2 Contraintes non négociables
- 100 % hors-ligne : **aucune police/lib externe** (pas de Google Fonts, pas de CDN). Polices système ou fichier local ajouté aux ASSETS.
- Ne pas toucher : `logic.js`, `store.js`, schéma IndexedDB, stratégie `sw.js`, hooks §2.3.
- Accessibilité : cibles ≥ 44 px, contraste AA, focus visible, `aria-*` des sheets, `prefers-reduced-motion` → toutes les animations non essentielles coupées (fondu court max).
- Dark mode complet (salle de sport = souvent sombre) — envisager dark par défaut ou toggle.
- Perf : animer uniquement `transform`/`opacity` ; 60 fps sur iPhone ; pas de layout thrash pendant le chrono.
- Lisibilité en séance : chiffres (kg/reps/temps) très gros, mono tabulaire, une main, pouce.
- Volt réservé aux PRs (garder la rareté du signal).

### 9.3 Moments de mouvement à concevoir (par priorité)
1. **Validation de série** : press → stamp → la ligne se « verrouille », compteur de séries de la carte qui avance, haptique visuelle.
2. **Chrono de repos** : ouverture en morph depuis le ✓, aiguille/arc fluide (rAF ou CSS `@property` sur un angle), pulsation aux 10 dernières secondes, fin = flash + retour.
3. **PR** : célébration courte et sobre (volt, éclat sur le chiffre, pas de confettis cheap).
4. **Navigation** : transitions d'onglets directionnelles, segments avec indicateur glissant, sheets à ressort qui suivent le doigt.
5. **Listes** : apparition échelonnée légère (stagger 20–40 ms), une seule fois (pas à chaque re-render).
6. **Récap fin de séance** : KPIs qui comptent jusqu'à leur valeur, PRs révélés un par un.
7. **Onboarding** : progression entre étapes avec continuité spatiale.
8. **Home** : hero vivant (cadran/aiguille au repos, progression de la semaine).
9. États pressés `:active` uniformes (scale .97 + ombre) sur tout ce qui est tappable.

### 9.4 Recommandations techniques
- Créer une échelle de mouvement en tokens : `--dur-1 120ms --dur-2 200ms --dur-3 320ms --dur-4 500ms`, `--ease-out cubic-bezier(.2,.8,.2,1)`, `--ease-spring` (via `linear()` CSS, supporté Safari 17.2+), `--ease-in-out`.
- **View Transitions API** pour route/segment avec fallback ; marquer `view-transition-name` sur hero ↔ séance.
- Supprimer `riseIn` global au re-render ; ne jouer les entrées que lors d'un `go()` réel (flag `route changed`).
- Migrer les styles inline vers des classes au fil de la refonte, écran par écran (Séance et Chrono d'abord).
- Garder le JS d'animation minimal (WAAPI `element.animate()` pour les one-shots : stamp, PR, compteurs).

### 9.5 Ordre de travail conseillé
1. Tokens (couleur, typo, rayon, ombre, **mouvement**) + dark.
2. Séance + Chrono (80 % de l'usage réel).
3. Home + tab bar + transitions de navigation.
4. Sheets (ressort, gestes).
5. Programme / Volume / Progrès / Réglages.
6. Onboarding + récap + PR.
7. Passe reduced-motion, contraste, perf ; tests §7 ; bump version.

### 9.6 Définition de « fini »
Tous les parcours §7 passent, liste des `data-action` identique, 0 erreur console, captures light/dark/reduced-motion des 5 onglets + séance + chrono + récap, version bumpée, déployée et vérifiée sur iPhone.
