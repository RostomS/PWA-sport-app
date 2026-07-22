/* data.js — Bibliothèque d'exercices de base + programme PPL A/B (6 jours) et fusion 4 jours.
   Aucune donnée réseau. Tout est statique et sert de "seed" à IndexedDB au premier lancement.
   Groupes musculaires canoniques (pour le dashboard volume) :
   Pectoraux, Dos, Épaules, Triceps, Biceps, Quadriceps, Ischios, Fessiers, Mollets.
   pattern : push-h | push-v | pull-h | pull-v | hinge | squat | curl | extension | isolation
   role    : compound | isolation   (utilisé par la recompo temps + la logique de stagnation)
   elbowSensitive : rappel mobilité coude pendant le repos
   elbowUnsafe    : contre-indiqué (valgus) → marqué "à éviter", remplacement proposé */

const BASE_EXERCISES = [
  // ---------------- PUSH A ----------------
  { id:'inclineDbPress', name:'Développé incliné haltères', musclePrimary:'Pectoraux', muscleSecondary:['Épaules','Triceps'], equipment:'haltère', pattern:'push-h', role:'compound', repMin:8, repMax:10,
    tips:['Omoplates serrées, léger arc thoracique','Descends jusqu’à étirer le pec, pas plus bas que confortable','Coudes ~45°, pas d’évasement complet'], biomech:'Cible le haut des pectoraux ; l’inclinaison recrute davantage le faisceau claviculaire.' },
  { id:'flatDbPress', name:'Développé couché haltères', musclePrimary:'Pectoraux', muscleSecondary:['Triceps','Épaules'], equipment:'haltère', pattern:'push-h', role:'compound', repMin:8, repMax:10,
    tips:['Trajectoire en léger arc vers le haut','Poignets alignés sur les avant-bras','Contrôle la descente 2-3 s'], biomech:'Volume de base pour l’ensemble du pectoral, amplitude libre supérieure à la barre.' },
  { id:'cableFly', name:'Écarté câble', musclePrimary:'Pectoraux', muscleSecondary:[], equipment:'câble', pattern:'isolation', role:'isolation', repMin:12, repMax:15,
    tips:['Léger fléchissement de coude fixe','Cherche l’étirement puis la contraction, pas le poids','Croise légèrement en fin de mouvement'], biomech:'Tension constante sur le pec en isolation, idéal en fin de séance.' },
  { id:'pecDeck', name:'Pec deck', musclePrimary:'Pectoraux', muscleSecondary:[], equipment:'machine', pattern:'isolation', role:'isolation', repMin:12, repMax:15,
    tips:['Dos plaqué au dossier','Amplitude contrôlée, pas de claquement','Serre 1 s en position fermée'], biomech:'Isolation guidée du pec, alternative stable à l’écarté câble.' },
  { id:'lateralRaiseDb', name:'Élévations latérales', musclePrimary:'Épaules', muscleSecondary:[], equipment:'haltère', pattern:'isolation', role:'isolation', repMin:12, repMax:15,
    tips:['Monte à hauteur d’épaule, pas plus','Mène par le coude, pas par la main','Pas d’élan de buste'], biomech:'Cible le deltoïde latéral pour la largeur d’épaule.' },
  { id:'triPushdownRope', name:'Extension triceps câble corde', musclePrimary:'Triceps', muscleSecondary:[], equipment:'câble', pattern:'extension', role:'isolation', repMin:10, repMax:12, elbowSensitive:true,
    tips:['Coudes fixes le long du corps','Écarte la corde en fin d’extension','Ne verrouille pas brutalement'], biomech:'Charge le triceps sans étirement extrême de l’articulation.' },
  { id:'triOverheadDb', name:'Extension triceps haltère au-dessus tête', musclePrimary:'Triceps', muscleSecondary:[], equipment:'haltère', pattern:'extension', role:'isolation', repMin:10, repMax:12, elbowSensitive:true,
    tips:['Coudes serrés vers l’avant','Descends contrôlé, pas de rebond','Étirement sans forcer le fond'], biomech:'Sollicite la longue portion du triceps par la position bras au-dessus tête.' },

  // ---------------- PULL A ----------------
  { id:'latPulldownWide', name:'Tirage vertical prise large', musclePrimary:'Dos', muscleSecondary:['Biceps'], equipment:'machine', pattern:'pull-v', role:'compound', repMin:8, repMax:10,
    tips:['Amène la barre au haut de la poitrine','Pense à descendre les coudes, pas tirer avec les bras','Léger recul du buste seulement'], biomech:'Accent largeur du dos (grand dorsal), plan vertical.' },
  { id:'dbRow', name:'Rowing haltère unilatéral', musclePrimary:'Dos', muscleSecondary:['Biceps'], equipment:'haltère', pattern:'pull-h', role:'compound', repMin:8, repMax:10,
    tips:['Dos neutre, appui main/genou','Tire vers la hanche','Contrôle l’étirement en bas'], biomech:'Épaisseur du dos, travail unilatéral pour l’équilibre gauche/droite.' },
  { id:'cableRowClose', name:'Tirage horizontal câble prise serrée', musclePrimary:'Dos', muscleSecondary:['Biceps'], equipment:'câble', pattern:'pull-h', role:'compound', repMin:10, repMax:12,
    tips:['Buste stable, pas de balancier','Serre les omoplates en fin','Étire complètement devant'], biomech:'Milieu du dos et rhomboïdes, tension constante.' },
  { id:'facePull', name:'Face pull', musclePrimary:'Épaules', muscleSecondary:['Dos'], equipment:'câble', pattern:'pull-h', role:'isolation', repMin:15, repMax:15,
    tips:['Tire vers le front, coudes hauts','Rotation externe en fin','Léger et contrôlé'], biomech:'Deltoïde postérieur et rotateurs externes, santé de l’épaule.' },
  { id:'dbCurlSupine', name:'Curl supination haltères', musclePrimary:'Biceps', muscleSecondary:[], equipment:'haltère', pattern:'curl', role:'isolation', repMin:10, repMax:12, elbowSensitive:true,
    tips:['Supine (tourne la paume) en montant','Coudes fixes, pas d’élan','Descente contrôlée'], biomech:'Variante coude-safe : la supination libre ménage le valgus, contrairement à la barre droite.' },
  { id:'hammerCurl', name:'Curl marteau', musclePrimary:'Biceps', muscleSecondary:['Avant-bras'], equipment:'haltère', pattern:'curl', role:'isolation', repMin:12, repMax:12, elbowSensitive:true,
    tips:['Prise neutre (marteau)','Coudes collés au corps','Pas de balancier d’épaule'], biomech:'Cible le brachial et le brachio-radial, prise neutre douce pour le coude.' },

  // ---------------- LEGS A ----------------
  { id:'gobletSquat', name:'Squat gobelet ou back squat', musclePrimary:'Quadriceps', muscleSecondary:['Fessiers'], equipment:'haltère', pattern:'squat', role:'compound', repMin:8, repMax:10,
    tips:['Talons ancrés, genoux vers l’extérieur','Buste haut','Descends sous parallèle si mobilité ok'], biomech:'Accent quadriceps ; le gobelet garde le buste vertical.' },
  { id:'legPress', name:'Presse à cuisses', musclePrimary:'Quadriceps', muscleSecondary:['Fessiers'], equipment:'machine', pattern:'squat', role:'compound', repMin:10, repMax:12,
    tips:['Pieds mi-hauteur du plateau','Ne verrouille pas les genoux','Amplitude sans décoller le bassin'], biomech:'Charge le quadriceps en sécurité, sans contrainte axiale.' },
  { id:'walkingLunge', name:'Fentes marchées', musclePrimary:'Quadriceps', muscleSecondary:['Fessiers','Ischios'], equipment:'haltère', pattern:'squat', role:'compound', repMin:10, repMax:10, perLeg:true,
    tips:['Grand pas, genou arrière vers le sol','Buste droit','Pousse dans le talon avant'], biomech:'Unilatéral, travaille équilibre et quadriceps sous étirement.' },
  { id:'legExtension', name:'Leg extension', musclePrimary:'Quadriceps', muscleSecondary:[], equipment:'machine', pattern:'extension', role:'isolation', repMin:12, repMax:15,
    tips:['Serre le quadriceps en haut 1 s','Descente contrôlée','Dos plaqué'], biomech:'Isolation pure du quadriceps, finisher.' },
  { id:'standingCalf', name:'Mollets debout', musclePrimary:'Mollets', muscleSecondary:[], equipment:'machine', pattern:'isolation', role:'isolation', repMin:12, repMax:15,
    tips:['Amplitude complète, étire en bas','Pause en haut','Tempo lent'], biomech:'Gastrocnémien (jambe tendue).' },

  // ---------------- PUSH B ----------------
  { id:'dbShoulderPress', name:'Développé militaire haltères', musclePrimary:'Épaules', muscleSecondary:['Triceps'], equipment:'haltère', pattern:'push-v', role:'compound', repMin:8, repMax:10,
    tips:['Gainage abdo, pas de cambrure','Coudes légèrement devant','Descends aux oreilles'], biomech:'Accent deltoïde antérieur, plan vertical.' },
  { id:'machineBenchPress', name:'Développé couché machine ou barre', musclePrimary:'Pectoraux', muscleSecondary:['Triceps'], equipment:'machine', pattern:'push-h', role:'compound', repMin:8, repMax:10,
    tips:['Trajectoire guidée, tempo contrôlé','Omoplates serrées','Pas de rebond en bas'], biomech:'Maintien du volume pectoral en jour épaules.' },
  { id:'cableLateralRaise', name:'Élévations latérales câble', musclePrimary:'Épaules', muscleSecondary:[], equipment:'câble', pattern:'isolation', role:'isolation', repMin:15, repMax:15,
    tips:['Câble derrière le corps pour tension constante','Monte à l’horizontale','Contrôle la descente'], biomech:'Deltoïde latéral avec tension continue (câble).' },
  { id:'rearDeltFly', name:'Écarté arrière (rear delt)', musclePrimary:'Épaules', muscleSecondary:[], equipment:'machine', pattern:'isolation', role:'isolation', repMin:12, repMax:15,
    tips:['Buste penché ou machine réglée','Mène par les coudes','Pas de trapèzes'], biomech:'Deltoïde postérieur, équilibre de l’épaule.' },
  { id:'dipsOrPushdown', name:'Dips ou pushdown corde', musclePrimary:'Triceps', muscleSecondary:['Pectoraux'], equipment:'poids du corps', pattern:'extension', role:'isolation', repMin:10, repMax:12, elbowSensitive:true,
    tips:['Buste vertical pour accent triceps','Descente contrôlée','Amplitude confortable pour l’épaule'], biomech:'Charge le triceps ; version pushdown si l’épaule est sensible.' },
  { id:'triUnilateralCable', name:'Extension triceps unilatérale câble', musclePrimary:'Triceps', muscleSecondary:[], equipment:'câble', pattern:'extension', role:'isolation', repMin:12, repMax:12, elbowSensitive:true,
    tips:['Coude fixe','Extension complète sans à-coup','Travaille un côté à la fois'], biomech:'Corrige les asymétries de triceps, tension câble.' },

  // ---------------- PULL B ----------------
  { id:'barbellRow', name:'Rowing barre ou T-bar', musclePrimary:'Dos', muscleSecondary:['Biceps'], equipment:'barre', pattern:'pull-h', role:'compound', repMin:8, repMax:10,
    tips:['Buste ~45°, dos neutre','Tire vers le nombril','Pas de secousse lombaire'], biomech:'Accent épaisseur du dos, forte charge globale.' },
  { id:'latPulldownNeutral', name:'Tirage vertical prise neutre', musclePrimary:'Dos', muscleSecondary:['Biceps'], equipment:'machine', pattern:'pull-v', role:'compound', repMin:8, repMax:10,
    tips:['Prise neutre douce pour l’épaule','Descends les coudes vers les côtes','Étire en haut'], biomech:'Largeur du dos, prise neutre confortable.' },
  { id:'seatedCableRow', name:'Rowing câble assis', musclePrimary:'Dos', muscleSecondary:['Biceps'], equipment:'câble', pattern:'pull-h', role:'compound', repMin:10, repMax:12,
    tips:['Buste stable','Serre les omoplates','Étire complètement devant'], biomech:'Milieu du dos, tension constante.' },
  { id:'cableCurl', name:'Curl câble', musclePrimary:'Biceps', muscleSecondary:[], equipment:'câble', pattern:'curl', role:'isolation', repMin:10, repMax:12, elbowSensitive:true,
    tips:['Coudes fixes','Tension continue du bas au haut','Pas d’élan'], biomech:'Biceps sous tension câble constante, doux pour le coude.' },
  { id:'inclineDbCurl', name:'Curl incliné haltères', musclePrimary:'Biceps', muscleSecondary:[], equipment:'haltère', pattern:'curl', role:'isolation', repMin:12, repMax:12, elbowSensitive:true,
    tips:['Banc incliné, bras en arrière du corps','Étirement complet en bas','Supination progressive'], biomech:'Étire la longue portion du biceps, position coude-safe.' },

  // ---------------- LEGS B ----------------
  { id:'rdl', name:'Soulevé de terre roumain', musclePrimary:'Ischios', muscleSecondary:['Fessiers','Dos'], equipment:'barre', pattern:'hinge', role:'compound', repMin:8, repMax:10,
    tips:['Hanche en arrière, dos neutre','Barre proche des jambes','Étire les ischios, pas le bas du dos'], biomech:'Charnière de hanche, accent ischios/fessiers.' },
  { id:'hipThrust', name:'Hip thrust', musclePrimary:'Fessiers', muscleSecondary:['Ischios'], equipment:'barre', pattern:'hinge', role:'compound', repMin:8, repMax:10,
    tips:['Menton rentré, côtes basses','Pousse dans les talons','Serre les fessiers en haut 1 s'], biomech:'Extension de hanche, accent fessiers maximal.' },
  { id:'lyingLegCurl', name:'Leg curl allongé ou assis', musclePrimary:'Ischios', muscleSecondary:[], equipment:'machine', pattern:'curl', role:'isolation', repMin:10, repMax:12,
    tips:['Bassin plaqué','Contrôle la phase négative','Amplitude complète'], biomech:'Flexion de genou, isolation des ischios.' },
  { id:'bulgarianSplit', name:'Bulgarian split squat', musclePrimary:'Quadriceps', muscleSecondary:['Fessiers'], equipment:'haltère', pattern:'squat', role:'compound', repMin:10, repMax:10, perLeg:true,
    tips:['Pied arrière surélevé','Buste selon accent (droit=quadri)','Descente contrôlée'], biomech:'Unilatéral, forte demande sur quadriceps et fessiers.' },
  { id:'seatedCalf', name:'Mollets assis', musclePrimary:'Mollets', muscleSecondary:[], equipment:'machine', pattern:'isolation', role:'isolation', repMin:15, repMax:15,
    tips:['Genou fléchi cible le soléaire','Amplitude complète','Tempo lent, pause étirée'], biomech:'Soléaire (genou fléchi).' },

  // ---------------- Alternatives / bibliothèque étendue (substitutions) ----------------
  { id:'chestPressMachine', name:'Développé pectoraux machine', musclePrimary:'Pectoraux', muscleSecondary:['Triceps'], equipment:'machine', pattern:'push-h', role:'compound', repMin:10, repMax:12,
    tips:['Réglage siège hauteur mamelon','Tempo contrôlé'], biomech:'Alternative guidée au développé libre.' },
  { id:'inclineMachinePress', name:'Développé incliné machine', musclePrimary:'Pectoraux', muscleSecondary:['Épaules'], equipment:'machine', pattern:'push-h', role:'compound', repMin:10, repMax:12,
    tips:['Trajectoire montante','Omoplates serrées'], biomech:'Haut de pec en version guidée.' },
  { id:'cableCrossover', name:'Cross-over poulies', musclePrimary:'Pectoraux', muscleSecondary:[], equipment:'câble', pattern:'isolation', role:'isolation', repMin:12, repMax:15,
    tips:['Léger buste en avant','Croise en fin'], biomech:'Isolation pec, angle réglable.' },
  { id:'machineShoulderPress', name:'Développé épaules machine', musclePrimary:'Épaules', muscleSecondary:['Triceps'], equipment:'machine', pattern:'push-v', role:'compound', repMin:10, repMax:12,
    tips:['Dos plaqué','Descente aux oreilles'], biomech:'Développé vertical guidé.' },
  { id:'chinUp', name:'Traction supination', musclePrimary:'Dos', muscleSecondary:['Biceps'], equipment:'poids du corps', pattern:'pull-v', role:'compound', repMin:6, repMax:10,
    tips:['Amplitude complète','Descente contrôlée'], biomech:'Largeur dos + biceps, prise supination.' },
  { id:'tbarRow', name:'T-bar row', musclePrimary:'Dos', muscleSecondary:['Biceps'], equipment:'machine', pattern:'pull-h', role:'compound', repMin:8, repMax:10,
    tips:['Dos neutre','Tire vers le bas des côtes'], biomech:'Épaisseur du dos, appui poitrine possible.' },
  { id:'hackSquat', name:'Hack squat', musclePrimary:'Quadriceps', muscleSecondary:['Fessiers'], equipment:'machine', pattern:'squat', role:'compound', repMin:8, repMax:12,
    tips:['Pieds bas pour accent quadri','Amplitude contrôlée'], biomech:'Quadriceps guidé, trajectoire fixe.' },
  { id:'seatedLegCurl', name:'Leg curl assis', musclePrimary:'Ischios', muscleSecondary:[], equipment:'machine', pattern:'curl', role:'isolation', repMin:10, repMax:12,
    tips:['Bassin bloqué','Négative lente'], biomech:'Ischios en position assise (plus d’étirement).' },
  { id:'gluteHamRaise', name:'Glute-ham raise', musclePrimary:'Ischios', muscleSecondary:['Fessiers'], equipment:'poids du corps', pattern:'hinge', role:'compound', repMin:8, repMax:12,
    tips:['Descente contrôlée','Gainage constant'], biomech:'Ischios en chaîne, forte demande excentrique.' },
  { id:'inclineTreadmill', name:'Marche inclinée (finisher)', musclePrimary:'Cardio', muscleSecondary:[], equipment:'machine', pattern:'isolation', role:'isolation', repMin:0, repMax:0,
    tips:['Ne te tiens pas aux barres','Respiration régulière'], biomech:'Cardio à faible impact, préserve la récupération.' },

  // ---------------- Contre-indiqués (valgus du coude) : marqués "à éviter" ----------------
  { id:'straightBarCurl', name:'Curl barre droite', musclePrimary:'Biceps', muscleSecondary:[], equipment:'barre', pattern:'curl', role:'isolation', repMin:8, repMax:12, elbowSensitive:true, elbowUnsafe:true, replaceWith:'dbCurlSupine',
    tips:['⚠️ Fixe les poignets en pronation forcée'], biomech:'À éviter : la prise barre droite verrouille l’avant-bras et sollicite le valgus. Préfère la variante haltère supination.' },
  { id:'ezBarTriceps', name:'Extension triceps barre EZ (extension extrême)', musclePrimary:'Triceps', muscleSecondary:[], equipment:'barre', pattern:'extension', role:'isolation', repMin:8, repMax:12, elbowSensitive:true, elbowUnsafe:true, replaceWith:'triPushdownRope',
    tips:['⚠️ Étirement extrême sous barre EZ'], biomech:'À éviter : l’extension complète chargée sous barre EZ contraint le coude en valgus. Préfère câble corde ou haltère.' },
];

/* Programme — mode 6 jours PPL A/B. Ordre de rotation (suit l’usage, pas le calendrier). */
const PROGRAM_6 = [
  { id:'pushA', name:'Push A', code:'PUSH', focus:'Pecs · triceps · épaules', blocks:[
    ['inclineDbPress',4],['flatDbPress',3],['cableFly',3],['lateralRaiseDb',3],['triPushdownRope',3],['triOverheadDb',2] ] },
  { id:'pullA', name:'Pull A', code:'PULL', focus:'Dos largeur · biceps', blocks:[
    ['latPulldownWide',4],['dbRow',3],['cableRowClose',3],['facePull',3],['dbCurlSupine',3],['hammerCurl',2] ] },
  { id:'legsA', name:'Legs A', code:'LEGS', focus:'Quadriceps', blocks:[
    ['gobletSquat',4],['legPress',3],['walkingLunge',3],['legExtension',3],['standingCalf',3] ] },
  { id:'pushB', name:'Push B', code:'PUSH', focus:'Épaules · triceps · pecs', blocks:[
    ['dbShoulderPress',4],['machineBenchPress',3],['cableLateralRaise',3],['rearDeltFly',3],['dipsOrPushdown',3],['triUnilateralCable',2] ] },
  { id:'pullB', name:'Pull B', code:'PULL', focus:'Dos épaisseur · biceps', blocks:[
    ['barbellRow',4],['latPulldownNeutral',3],['seatedCableRow',3],['facePull',2],['cableCurl',3],['inclineDbCurl',2] ] },
  { id:'legsB', name:'Legs B', code:'LEGS', focus:'Ischios · fessiers', blocks:[
    ['rdl',4],['hipThrust',3],['lyingLegCurl',3],['bulgarianSplit',3],['seatedCalf',3] ] },
];

/* Mode 4 jours (Upper/Lower). Upper A = Push A + Pull A moins 1-2 isolations pour tenir
   dans l’heure ; Upper B idem. Legs A/B inchangés. Retour au 6 jours = on réutilise
   PROGRAM_6 (définitions d’origine) → les isolations retirées sont réintégrées, rien perdu. */
const PROGRAM_4 = [
  { id:'upperA', name:'Upper A', code:'UPPER', focus:'Haut du corps (A)', blocks:[
    ['inclineDbPress',4],['latPulldownWide',4],['dbRow',3],['lateralRaiseDb',3],['cableRowClose',3],['triPushdownRope',3],['dbCurlSupine',3] ],
    droppedFromSixDay:['flatDbPress','cableFly','triOverheadDb','facePull','hammerCurl'] },
  { id:'legsA', name:'Legs A', code:'LEGS', focus:'Quadriceps', blocks:[
    ['gobletSquat',4],['legPress',3],['walkingLunge',3],['legExtension',3],['standingCalf',3] ] },
  { id:'upperB', name:'Upper B', code:'UPPER', focus:'Haut du corps (B)', blocks:[
    ['dbShoulderPress',4],['barbellRow',4],['machineBenchPress',3],['seatedCableRow',3],['rearDeltFly',3],['dipsOrPushdown',3],['cableCurl',3] ],
    droppedFromSixDay:['cableLateralRaise','triUnilateralCable','latPulldownNeutral','facePull','inclineDbCurl'] },
  { id:'legsB', name:'Legs B', code:'LEGS', focus:'Ischios · fessiers', blocks:[
    ['rdl',4],['hipThrust',3],['lyingLegCurl',3],['bulgarianSplit',3],['seatedCalf',3] ] },
];

/* Full Body 3 jours — tout le corps à chaque séance, mais 3 séances VARIÉES
   (patterns et exercices différents chaque jour). Idéal fréquence basse / peu de temps. */
const FULLBODY_3 = [
  { id:'fb_a', name:'Full Body A', code:'FULL', focus:'Squat · poussée/tirage horizontal', blocks:[
    ['gobletSquat',3],['flatDbPress',3],['dbRow',3],['lyingLegCurl',2],['lateralRaiseDb',2],['dbCurlSupine',2] ] },
  { id:'fb_b', name:'Full Body B', code:'FULL', focus:'Hinge · poussée/tirage vertical', blocks:[
    ['rdl',3],['dbShoulderPress',3],['latPulldownWide',3],['legPress',3],['triPushdownRope',2],['hammerCurl',2] ] },
  { id:'fb_c', name:'Full Body C', code:'FULL', focus:'Fessiers · pecs haut · dos milieu', blocks:[
    ['hipThrust',3],['inclineDbPress',3],['seatedCableRow',3],['hackSquat',3],['cableLateralRaise',2],['cableCurl',2],['standingCalf',2] ] },
];

/* Arnold Split 6 jours — Pecs+Dos / Épaules+Bras / Jambes, en A puis B (chaque jour diffère). */
const ARNOLD_6 = [
  { id:'arn_cb_a', name:'Pecs + Dos A', code:'HAUT', focus:'Pecs · dos largeur', blocks:[
    ['inclineDbPress',4],['latPulldownWide',4],['flatDbPress',3],['dbRow',3],['cableFly',3],['facePull',2] ] },
  { id:'arn_sa_a', name:'Épaules + Bras A', code:'BRAS', focus:'Deltoïdes · biceps · triceps', blocks:[
    ['dbShoulderPress',4],['lateralRaiseDb',3],['dbCurlSupine',3],['triPushdownRope',3],['hammerCurl',2],['triOverheadDb',2] ] },
  { id:'arn_l_a', name:'Jambes A', code:'LEGS', focus:'Quadriceps', blocks:[
    ['gobletSquat',4],['legPress',3],['walkingLunge',3],['lyingLegCurl',3],['standingCalf',3] ] },
  { id:'arn_cb_b', name:'Pecs + Dos B', code:'HAUT', focus:'Pecs · dos épaisseur', blocks:[
    ['machineBenchPress',4],['barbellRow',4],['inclineMachinePress',3],['seatedCableRow',3],['cableCrossover',3],['facePull',2] ] },
  { id:'arn_sa_b', name:'Épaules + Bras B', code:'BRAS', focus:'Deltoïdes · bras (variation)', blocks:[
    ['machineShoulderPress',4],['cableLateralRaise',3],['inclineDbCurl',3],['dipsOrPushdown',3],['cableCurl',2],['triUnilateralCable',2] ] },
  { id:'arn_l_b', name:'Jambes B', code:'LEGS', focus:'Ischios · fessiers', blocks:[
    ['rdl',4],['hipThrust',3],['bulgarianSplit',3],['seatedLegCurl',3],['seatedCalf',3] ] },
];

/* Bibliothèque de programmes. Chaque entrée expose ses séances (déjà VARIÉES d'un jour
   à l'autre). `special` marque les deux programmes historiques liés (fusion PPL↔U/L). */
const PROGRAMS = [
  { id:'ppl6', name:'PPL 6 jours', days:'6 jours · 1 repos', special:'ppl',
    desc:'Push / Pull / Legs en A-B. La référence hypertrophie, 6 séances toutes différentes.', sessions: PROGRAM_6 },
  { id:'ul4', name:'Upper / Lower 4 jours', days:'4 jours', special:'ul',
    desc:'Haut / Bas, plus de récupération. Fusion du PPL avec 1-2 isolations en moins.', sessions: PROGRAM_4 },
  { id:'fb3', name:'Full Body 3 jours', days:'3 jours',
    desc:'Tout le corps à chaque séance, 3 séances variées. Parfait quand le temps manque.', sessions: FULLBODY_3 },
  { id:'arnold6', name:'Arnold Split 6 jours', days:'6 jours · 1 repos',
    desc:'Pecs+Dos / Épaules+Bras / Jambes, en A-B. Beaucoup de volume, 6 jours variés.', sessions: ARNOLD_6 },
];

const MUSCLE_GROUPS = ['Pectoraux','Dos','Épaules','Triceps','Biceps','Quadriceps','Ischios','Fessiers','Mollets'];

// Expose global (scripts classiques, pas de bundler — robuste sur Safari installé).
window.DATA = { BASE_EXERCISES, PROGRAM_6, PROGRAM_4, FULLBODY_3, ARNOLD_6, PROGRAMS, MUSCLE_GROUPS };
