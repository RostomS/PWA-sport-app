/* illustrations.js — Génère un schéma SVG vectoriel du mouvement pour CHAQUE exercice.
   Un template par pattern de mouvement (une dizaine au total). Un exercice custom reçoit
   automatiquement le template de son pattern → aucun exercice, même custom, sans visuel.
   Trait = couleurs du système (ink pour le corps, signal pour la flèche de mouvement,
   volt jamais utilisé ici). currentColor pour s’adapter au thème de la carte. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const S = 120;

  // primitives -------------------------------------------------------------
  const head = (cx, cy, r = 8) => `<circle cx="${cx}" cy="${cy}" r="${r}" class="ill-body"/>`;
  const line = (x1, y1, x2, y2, cls = 'ill-body') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}"/>`;
  const floor = () => line(10, 110, 110, 110, 'ill-floor');
  const bar = (x, y, w = 34) => `<line x1="${x - w / 2}" y1="${y}" x2="${x + w / 2}" y2="${y}" class="ill-load"/><circle cx="${x - w / 2}" cy="${y}" r="4.5" class="ill-load-dot"/><circle cx="${x + w / 2}" cy="${y}" r="4.5" class="ill-load-dot"/>`;
  const dumbbell = (x, y) => `<line x1="${x - 7}" y1="${y}" x2="${x + 7}" y2="${y}" class="ill-load"/><rect x="${x - 9}" y="${y - 5}" width="4" height="10" rx="1.5" class="ill-load-dot"/><rect x="${x + 5}" y="${y - 5}" width="4" height="10" rx="1.5" class="ill-load-dot"/>`;
  const arrow = (x1, y1, x2, y2) => {
    const a = Math.atan2(y2 - y1, x2 - x1);
    const h = 6;
    const p1 = [x2 - h * Math.cos(a - 0.5), y2 - h * Math.sin(a - 0.5)];
    const p2 = [x2 - h * Math.cos(a + 0.5), y2 - h * Math.sin(a + 0.5)];
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="ill-move"/><polyline points="${p1[0]},${p1[1]} ${x2},${y2} ${p2[0]},${p2[1]}" class="ill-move" fill="none"/>`;
  };

  // one template per pattern ----------------------------------------------
  const T = {
    'push-h': () => // développé horizontal : allongé, poussée verticale de la charge
      floor() + `<line x1="24" y1="92" x2="92" y2="92" class="ill-body"/>` + head(24, 84) +
      line(40, 92, 40, 70) + line(64, 92, 64, 70) + bar(52, 62) + arrow(52, 84, 52, 60),
    'push-v': () => // développé vertical : debout, poussée au-dessus de la tête
      floor() + line(52, 108, 52, 66) + head(52, 56) +
      line(52, 72, 38, 60) + line(52, 72, 66, 60) + bar(52, 40) + arrow(52, 60, 52, 38),
    'pull-v': () => // tirage vertical : traction des coudes vers le bas
      floor() + bar(52, 22, 40) + line(38, 22, 44, 52) + line(66, 22, 60, 52) +
      head(52, 60) + line(52, 68, 52, 100) + arrow(52, 30, 52, 54),
    'pull-h': () => // tirage horizontal : buste penché, tire la charge vers soi
      floor() + line(30, 100, 78, 78) + head(84, 74) + line(56, 88, 40, 96) +
      dumbbell(38, 100) + arrow(40, 96, 60, 84),
    'hinge': () => // charnière de hanche : buste penché, charge le long des jambes
      floor() + line(52, 108, 52, 74) + line(52, 74, 80, 66) + head(86, 63) +
      line(56, 74, 56, 100) + bar(56, 100, 26) + arrow(70, 96, 60, 76),
    'squat': () => // squat : flexion des genoux, remontée
      floor() + line(40, 108, 46, 82) + line(46, 82, 60, 90) + line(60, 90, 62, 108) +
      line(46, 82, 50, 60) + head(50, 52) + bar(50, 46, 30) + arrow(84, 92, 84, 62),
    'curl': () => // flexion de coude : avant-bras remonte
      floor() + line(52, 108, 52, 62) + head(52, 52) + line(52, 68, 44, 88) +
      dumbbell(44, 88) + arrow(58, 88, 58, 64),
    'extension': () => // extension de coude : avant-bras se déploie vers le bas
      floor() + line(52, 108, 52, 62) + head(52, 52) + line(52, 68, 44, 70) +
      line(44, 70, 44, 92) + dumbbell(44, 92) + arrow(62, 70, 62, 92),
    'isolation': () => // isolation générique : mouvement d’un segment autour d’un pivot
      floor() + line(52, 108, 52, 62) + head(52, 52) + line(52, 70, 34, 70) + line(52, 70, 70, 70) +
      dumbbell(30, 70) + dumbbell(74, 70) + arrow(30, 82, 30, 66) + arrow(74, 82, 74, 66),
    'cardio': () => // finisher marche inclinée
      `<line x1="12" y1="104" x2="96" y2="72" class="ill-floor"/>` + line(60, 90, 60, 58) +
      head(60, 48) + line(60, 64, 74, 74) + line(60, 64, 48, 76) + line(60, 90, 74, 96) +
      line(60, 90, 48, 82) + arrow(84, 80, 96, 74),
  };

  function svgFor(pattern, muscle) {
    const draw = T[muscle === 'Cardio' ? 'cardio' : pattern] || T['isolation'];
    return `<svg class="illustration" viewBox="0 0 ${S} ${S}" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid meet">${draw()}</svg>`;
  }

  window.ILLU = { svgFor, patterns: Object.keys(T) };
})();
