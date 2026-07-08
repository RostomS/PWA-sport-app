# Direction design — « Chronographe »

Méthode en deux passes exigée par le brief. Passe 1 = proposition, passe 2 = critique
et révision avant la moindre ligne de CSS.

## Passe 1 — Système proposé

**Concept directeur.** Une app qu'on regarde une seconde entre deux séries, en salle,
sous une lumière quelconque. La référence n'est pas « app fitness » mais **instrument de
chronométrage sportif** : un chronographe de piste, un cadran de lap-timer. Les chiffres
sont l'information, pas la décoration. Tout est pensé pour la lecture rapide et l'action.

**Palette (light-first, lisible en salle).**
- `--ink   #16181F` — texte / structure (jamais le fond : on évite le cluster « quasi-noir »)
- `--paper #EDF0F4` — fond, gris froid (pas de crème : on évite le cluster « crème + serif »)
- `--card  #FFFFFF` — surfaces
- `--steel #2B3A67` — bleu acier profond, tonalité structurante
- `--signal#3D5AFE` — bleu électrique, couleur d'action unique
- `--volt  #C6F135` — vert-citron, **réservé strictement aux records / réussite**
- `--amber #FF9E2C` — fatigue / deload / avertissement doux

**Typographie.**
- *Display* : `system-ui` en graisse lourde, tracking serré négatif — titres de séance.
  Du caractère par le poids et le calage, pas par une serif décorative.
- *Body* : pile système sans-serif.
- *Utility / chiffres* : pile monospace (`ui-monospace, SF Mono…`) + `tabular-nums`.
  Poids / reps / RIR / durées sont des **relevés d'instrument**, alignés, calibrés.
  Échelle numérique explicite : readout XL (séance du jour), L (charges), M (deltas).

**Layout.** Accueil = une thèse verticale, une seule carte qui répond à une question :
quelle séance aujourd'hui, combien de temps, quel état. Le déroulé de séance est une
**liste ordonnée numérotée** — la numérotation encode le vrai ordre d'exécution.

```
┌───────────────────────────┐
│  AUJOURD'HUI              │
│  ▸ PUSH A                 │  ← display XL
│  ~58 min · séance + cardio│  ← readout mono
│  [fatigue ok][6 jours]    │  ← chips d'état
│                           │
│  ┌─────────────────────┐  │
│  │  DÉMARRER  ▸         │  │  ← CTA signal, plein
│  └─────────────────────┘  │
│  À suivre · Pull A · Legs A│  ← aperçu lecture seule
└───────────────────────────┘
```

**Élément signature.** Le **timer de repos en cadran de chronographe** : un anneau qui
se vide, un relevé mono central, une aiguille de balayage. C'est le moment qu'on regarde
le plus souvent ; c'est là qu'on dépense l'audace. La validation d'une série « tamponne »
la ligne (pulse + coche) et arme le cadran.

## Passe 2 — Critique et révisions

- **« Bleu électrique = SaaS générique. »** Vrai risque. Révisé : le bleu n'est pas seul
  sur du sombre (ce serait le cluster #2). Il vit sur du **gris clair**, adossé à un bleu
  acier structurant, et l'audace réelle est déplacée sur le **cadran-chronographe** + le
  volt réservé aux PR. L'accent n'est donc pas « la » couleur mais un système à trois rôles
  distincts (action / structure / réussite).
- **« Volt partout = cluster vert acide. »** Discipline imposée : le volt n'apparaît que
  sur un record. Ailleurs, interdit. Un seul endroit s'en souvient.
- **« Numérotation = déco. »** Révisé pour qu'elle encode le déroulé réel de la séance,
  pas un compteur cosmétique. Un dashboard de stats, lui, n'est PAS numéroté.
- **« Cadran-timer = gadget. »** Justifié par l'usage : c'est l'écran le plus regardé de
  la séance, et le rappel mobilité coude s'y loge sans écran supplémentaire.
- **Plancher qualité :** mobile-first jusqu'aux petits écrans, focus clavier visible,
  contraste AA en conditions de salle, `prefers-reduced-motion` respecté partout.
