# Direction design — « Cadran » (v16)

Remplace « Chronographe affiné » (v15). Refonte de la peau et du mouvement uniquement :
`logic.js`, `store.js`, le schéma IndexedDB, la stratégie du service worker et tous les
hooks (`data-action`, `data-nav`, ids) sont inchangés. Seul ajout : `data-action="theme"`.

## Parti pris

Un **instrument de mesure**, pas une app fitness. Trois décisions tiennent tout le reste :

1. **Monochrome os & graphite.** L'action primaire n'est pas une couleur : c'est l'inversion
   (encre sur papier, os sur cadran). Contraste maximal, lisible en sueur, et aucune couleur
   ne se dévalue à force d'être partout.
2. **Une seule couleur vive : le vermillon de l'aiguille** (`--signal`). Elle ne marque que ce
   qui est *vivant ou en cours* : trotteuse, arc du chrono, série validée, onglet actif,
   semaine en cours, zone de volume réaliste. Jamais un fond de bouton texte (le blanc sur
   vermillon ne passe pas AA ; le ✓ validé utilise une encre sombre dessus).
3. **Volt = PR, rien d'autre.** Ambre = avertissement (deload, fatigue, coude).

Motifs récurrents : graduations (60 traits, 12 majeurs — `dialTicks()`), filets fins plutôt
qu'ombres, capitales condensées pour les titres (`font-stretch`, police système : rendu
condensé là où la police système expose un axe de largeur, normal ailleurs), chiffres en
mono tabulaire, étiquettes en mono capitales espacées (gravure de lunette).

## Tokens (`css/app.css`, `:root`)

- Surfaces : `--paper --card --sunk --line --line-2` · encres : `--ink --ink-2 --muted`.
- Cadran (toujours sombre : hero, programme actif) : `--face --face-ink --face-muted --face-line`.
- `--signal / --signal-ink / --on-signal`, `--volt`, `--amber`, `--danger`.
- Alias hérités gardés pour `ui.js` : `--steel`, `--accent-steel`, `--good`.
- Rayons 18 / 12 / 8. Mouvement : `--dur-1..4` (120 / 200 / 320 / 520 ms),
  `--ease-out`, `--ease-in`, `--ease-in-out`, `--ease-spring` (`linear()` si supporté, sinon bézier).
- Thème : auto (système) ou forcé via Réglages → `localStorage['chrono-theme']` →
  `html[data-theme]`, appliqué par `window.applyTheme()` (script inline d'`index.html`,
  avant le CSS). Les tokens sombres existent en deux exemplaires (media query + attribut) :
  toute modification doit être faite aux deux endroits.

## Système de mouvement

| Moment | Mécanisme |
|---|---|
| Navigation | `go()` → `render(true)` pose `.view.enter` + `data-dir` (−1/0/1 selon l'ordre des onglets). Cascade 30 ms sur les enfants. Un `render()` simple ne rejoue **rien**. |
| Tab bar | Construite une fois ; seul `aria-current` et `--tab-i` changent → l'index vermillon glisse au ressort. |
| Segments | `.seg2[data-seg][data-i]` + `syncSegs()` : l'indicateur repart de sa position précédente. |
| Série validée | `stampSet()` (WAAPI) : tampon du ✓, champs qui se verrouillent, pip et compteur de la carte. |
| Chrono | S'ouvre en cercle depuis le ✓ (`clip-path`, `--ox/--oy`). Piloté par une **échéance** (`endAt`), aiguille en rAF (transform seul), texte réécrit 1×/s. Pulsation ≤ 10 s. Fin = flash puis retour. |
| Sheets | Entrée au ressort, sortie animée (l'id `sheet` est libéré tout de suite), remplacement en fondu, glisser-pour-fermer qui part de la position du doigt. |
| Récap / PR | `countUp()` sur `[data-count]` ; bannière volt : apparition au ressort, éclat qui balaie, lignes révélées une à une. |
| Onboarding | La carte n'entre, dans le sens de la marche, que si l'étape change. |
| Mouvement réduit | Tout est coupé (durées ≈ 0, aiguilles figées, sorties immédiates) sauf un fondu de 120 ms sur chrono et sheets. |

Écart assumé par rapport à l'audit : **pas de View Transitions API**. Elle rend la mise à
jour du DOM asynchrone alors que tout `ui.js` suppose un rendu synchrone, gèle les taps
pendant la transition et capture toute la page. L'entrée CSS directionnelle donne l'essentiel
de l'effet sans ces risques.

## État et reste à faire (passation)

Fait : tokens, thème clair/sombre + bascule, séance, chrono, home, tab bar, sheets,
programme, volume, progrès, réglages, onboarding, récap/PR, icônes, ~180 styles inline migrés
en classes utilitaires. Vérifié par `tools/e2e.js` (57 contrôles × clair / sombre / mouvement
réduit, 0 erreur console).

Reste :
- **Vérification sur iPhone réel** (non faite) : rendu condensé des titres, 60 fps du chrono,
  ouverture `clip-path`, zones sûres.
- 27 `style="…"` restants dans `ui.js` (valeurs dynamiques ou mises en page ponctuelles).
- Éditeur « Mes séances » (`viewProgram`) et feuilles secondaires : héritent du système mais
  n'ont pas eu de passe dédiée.
- Illustrations d'exercices : recolorées, pas redessinées.
- Le bouton « Terminer la séance » est collant en bas de l'écran séance : à valider à l'usage.
- Dette inchangée : `ui.js` monolithe, `PROGRAMS_VERSION`, backlog fonctionnel (AUDIT §8).

Release : bumper `CACHE` (`sw.js`) **et** `APP_VERSION` (`js/app.js`) ; tout nouveau fichier
va dans `ASSETS`.
