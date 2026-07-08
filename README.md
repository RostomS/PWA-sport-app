# Chronographe — PWA de musculation

Suivi de musculation **PPL A/B**, installable sur iPhone via Safari (« Ajouter à l’écran
d’accueil »). **100 % local** : aucun backend, aucune donnée envoyée. Stockage IndexedDB,
service worker pour le hors-ligne, `manifest.json` pour l’installation.

## Installer sur iPhone
1. Héberge le dossier sur une URL HTTPS (GitHub Pages, Netlify, ou tout serveur statique).
2. Ouvre l’URL dans **Safari**.
3. Bouton Partager → **Ajouter à l’écran d’accueil**.
4. L’app se lance en plein écran, fonctionne hors-ligne, et garde tes données sur l’appareil.

> En local pour tester : `python3 -m http.server` puis ouvre `http://localhost:8000`
> (le service worker et IndexedDB exigent `localhost` ou HTTPS, pas `file://`).

## Design
Direction « Chronographe » (instrument de chronométrage sportif). La méthode de conception
en deux passes est documentée dans [`DESIGN.md`](DESIGN.md).

## Structure
```
index.html            shell + ordre de chargement des scripts
manifest.json         installation PWA (icônes, theme-color, standalone)
sw.js                 service worker (app shell en cache, offline-first)
css/app.css           système de design
js/data.js            bibliothèque d’exercices + programme PPL A/B (6j) et fusion 4j
js/illustrations.js   schémas SVG générés par pattern de mouvement
js/store.js           IndexedDB + état + rotation qui suit l’usage
js/logic.js           progression, stagnation, deload, volume, recompo temps, substitution
js/ui.js              rendu + interactions (toutes les vues)
js/app.js             bootstrap
icons/                icônes PNG (générées par tools/gen_icons.py)
```

## Fonctionnalités
Bibliothèque CRUD + illustrations garanties · substitution intelligente · carnet de séance
(poids/reps/RIR, delta, timer chronographe, superset) · double progression · détection de
stagnation (RIR avant volume) · dashboard volume hebdo · check-in fatigue · bascule 6j/4j
bidirectionnelle · deload automatique · finisher cardio · export/import JSON · vue
« Aujourd’hui » · rotation qui suit l’usage · séance adaptative au temps · rappel local ·
suivi de régularité sans culpabilisation · aperçu des prochaines séances · réordonnancement
ponctuel · arrondi aux incréments de la salle · records personnels · rappel mobilité coude.

Contrainte physique encodée : coude en valgus → variantes barre droite / EZ marquées
« à éviter », remplacement haltère/câble proposé systématiquement.

Tout est hors-ligne et privé.
