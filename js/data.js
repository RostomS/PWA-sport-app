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

  { id:'pullUp', name:'Traction pronation', musclePrimary:'Dos', muscleSecondary:['Biceps'], equipment:'poids du corps', pattern:'pull-v', role:'compound', repMin:6, repMax:10,
    tips:['Amplitude complète, menton au-dessus de la barre','Descends contrôlé, épaules basses','Lesté quand 10 reps deviennent faciles'], biomech:'Le meilleur constructeur de largeur du dos ; prise pronation = accent grand dorsal.' },
  { id:'machinePreacherCurl', name:'Curl pupitre machine', musclePrimary:'Biceps', muscleSecondary:[], equipment:'machine', pattern:'curl', role:'isolation', repMin:10, repMax:12, elbowSensitive:true,
    tips:['Bras calés sur le pupitre','Contraction complète en haut','Négative lente, étirement sans forcer'], biomech:'Isole le biceps sous étirement, sans triche d’épaule ; machine douce pour le coude.' },
  { id:'backExtension', name:'Extension lombaire (banc)', musclePrimary:'Fessiers', muscleSecondary:['Ischios','Dos'], equipment:'poids du corps', pattern:'hinge', role:'compound', repMin:12, repMax:15,
    tips:['Charnière de hanche, dos neutre','Serre les fessiers en haut, pas d’hyperextension','Lesté contre la poitrine si besoin'], biomech:'Renforce la chaîne postérieure (fessiers, ischios, érecteurs) sans charge axiale.' },
  { id:'hangingLegRaise', name:'Relevé de jambes suspendu', musclePrimary:'Abdos', muscleSecondary:[], equipment:'poids du corps', pattern:'isolation', role:'isolation', repMin:10, repMax:15,
    tips:['Enroule le bassin, ne balance pas','Contrôle la descente','Genoux fléchis si trop dur'], biomech:'Cible le grand droit et les fléchisseurs de hanche par la flexion du bassin.' },
  { id:'cableCrunch', name:'Crunch à la poulie', musclePrimary:'Abdos', muscleSecondary:[], equipment:'câble', pattern:'isolation', role:'isolation', repMin:12, repMax:20,
    tips:['Enroule la colonne vers le bassin','Hanches fixes, mène par les abdos','Contraction complète en bas'], biomech:'Charge les abdominaux en résistance progressive, amplitude d’enroulement complète.' },

  // ---------------- Contre-indiqués (valgus du coude) : marqués "à éviter" ----------------
  { id:'straightBarCurl', name:'Curl barre droite', musclePrimary:'Biceps', muscleSecondary:[], equipment:'barre', pattern:'curl', role:'isolation', repMin:8, repMax:12, elbowSensitive:true, elbowUnsafe:true, replaceWith:'dbCurlSupine',
    tips:['⚠️ Fixe les poignets en pronation forcée'], biomech:'À éviter : la prise barre droite verrouille l’avant-bras et sollicite le valgus. Préfère la variante haltère supination.' },
  { id:'ezBarTriceps', name:'Extension triceps barre EZ (extension extrême)', musclePrimary:'Triceps', muscleSecondary:[], equipment:'barre', pattern:'extension', role:'isolation', repMin:8, repMax:12, elbowSensitive:true, elbowUnsafe:true, replaceWith:'triPushdownRope',
    tips:['⚠️ Étirement extrême sous barre EZ'], biomech:'À éviter : l’extension complète chargée sous barre EZ contraint le coude en valgus. Préfère câble corde ou haltère.' },
];

/* Programme — mode 6 jours PPL A/B. Ordre de rotation (suit l’usage, pas le calendrier). */
const PROGRAM_6 = [
  { id:'pushA', name:'Push A', code:'PUSH', focus:'Pecs · triceps · épaules',
    note:'Développé incliné en premier : ton mouvement pecs le plus lourd, à faire frais pour charger et pousser en sécurité. Écartés, élévations et triceps ensuite, quand la fatigue compte moins.', blocks:[
    ['inclineDbPress',4],['flatDbPress',3],['cableFly',3],['lateralRaiseDb',3],['triPushdownRope',3],['triOverheadDb',2] ] },
  { id:'pullA', name:'Pull A', code:'PULL', focus:'Dos largeur · biceps',
    note:'Tirage vertical en ouverture pour la largeur du dos, puis rowing, tirage serré, face pull et deux exos de biceps pour finir.', blocks:[
    ['latPulldownWide',4],['dbRow',3],['cableRowClose',3],['facePull',3],['dbCurlSupine',3],['hammerCurl',2] ] },
  { id:'legsA', name:'Legs A', code:'LEGS', focus:'Quadriceps',
    note:'Squat lourd à froid (le mouvement le plus exigeant), puis presse et fentes pour le volume, leg extension, mollets et abdos.', blocks:[
    ['gobletSquat',4],['legPress',3],['walkingLunge',3],['legExtension',3],['standingCalf',3],['hangingLegRaise',2] ] },
  { id:'pushB', name:'Push B', code:'PUSH', focus:'Épaules · triceps · pecs',
    note:'Développé militaire en premier (accent épaules), puis couché machine, latérales, rear delts et triceps.', blocks:[
    ['dbShoulderPress',4],['machineBenchPress',3],['cableLateralRaise',3],['rearDeltFly',3],['dipsOrPushdown',3],['triUnilateralCable',2] ] },
  { id:'pullB', name:'Pull B', code:'PULL', focus:'Dos épaisseur · biceps',
    note:'Rowing barre lourd d’abord pour l’épaisseur, puis tirage neutre, rowing câble, face pull et biceps.', blocks:[
    ['barbellRow',4],['latPulldownNeutral',3],['seatedCableRow',3],['facePull',2],['cableCurl',3],['inclineDbCurl',2] ] },
  { id:'legsB', name:'Legs B', code:'LEGS', focus:'Ischios · fessiers',
    note:'Soulevé roumain en premier (ischios frais, bas du dos intact), hip thrust pour les fessiers, leg curl, split bulgare, mollets et abdos.', blocks:[
    ['rdl',4],['hipThrust',3],['lyingLegCurl',3],['bulgarianSplit',3],['seatedCalf',3],['cableCrunch',2] ] },
];

/* Mode 4 jours (Upper/Lower). Upper A = Push A + Pull A moins 1-2 isolations pour tenir
   dans l’heure ; Upper B idem. Legs A/B inchangés. Retour au 6 jours = on réutilise
   PROGRAM_6 (définitions d’origine) → les isolations retirées sont réintégrées, rien perdu. */
const PROGRAM_4 = [
  { id:'upperA', name:'Upper A', code:'UPPER', focus:'Haut du corps (A)',
    note:'Incliné et tirage vertical d’abord (les deux plus lourds du haut), puis rowing, latérales, tirage serré, triceps et biceps.', blocks:[
    ['inclineDbPress',4],['latPulldownWide',4],['dbRow',3],['lateralRaiseDb',3],['cableRowClose',3],['triPushdownRope',3],['dbCurlSupine',3] ],
    droppedFromSixDay:['flatDbPress','cableFly','triOverheadDb','facePull','hammerCurl'] },
  { id:'legsA', name:'Legs A', code:'LEGS', focus:'Quadriceps',
    note:'Squat lourd à froid, puis presse, fentes, leg extension, mollets et abdos.', blocks:[
    ['gobletSquat',4],['legPress',3],['walkingLunge',3],['legExtension',3],['standingCalf',3],['hangingLegRaise',2] ] },
  { id:'upperB', name:'Upper B', code:'UPPER', focus:'Haut du corps (B)',
    note:'Militaire et rowing barre d’abord, puis couché machine, tirage câble, rear delts, dips et biceps.', blocks:[
    ['dbShoulderPress',4],['barbellRow',4],['machineBenchPress',3],['seatedCableRow',3],['rearDeltFly',3],['dipsOrPushdown',3],['cableCurl',3] ],
    droppedFromSixDay:['cableLateralRaise','triUnilateralCable','latPulldownNeutral','facePull','inclineDbCurl'] },
  { id:'legsB', name:'Legs B', code:'LEGS', focus:'Ischios · fessiers',
    note:'Soulevé roumain en premier, hip thrust, leg curl, split bulgare, mollets et abdos.', blocks:[
    ['rdl',4],['hipThrust',3],['lyingLegCurl',3],['bulgarianSplit',3],['seatedCalf',3],['cableCrunch',2] ] },
];

/* Note d'ordre — vérité issue de la recherche : l'ordre pèse surtout sur la FORCE
   (ce que tu fais en premier progresse le plus), et peu sur l'hypertrophie tant que le
   volume proche de l'échec y est. Règle appliquée partout : compound le plus lourd en
   premier (tu es frais → plus de charge, plus de sécurité, meilleure technique),
   isolations en fin. */

/* Full Body 3 jours — tout le corps à chaque séance, 3 séances VARIÉES. */
const FULLBODY_3 = [
  { id:'fb_a', name:'Full Body A', code:'FULL', focus:'Squat · poussée/tirage horizontal',
    note:'Squat gobelet en premier : le mouvement qui recrute le plus de masse, à faire frais. Ensuite pecs/dos horizontaux, puis isolations et mollets.', blocks:[
    ['gobletSquat',4],['flatDbPress',3],['dbRow',3],['lyingLegCurl',3],['lateralRaiseDb',3],['dbCurlSupine',2],['standingCalf',2] ] },
  { id:'fb_b', name:'Full Body B', code:'FULL', focus:'Hinge · poussée/tirage vertical',
    note:'Soulevé roumain d’abord : chaîne postérieure lourde tant que le bas du dos est frais. Puis développé/tirage verticaux, triceps, biceps, abdos.', blocks:[
    ['rdl',4],['dbShoulderPress',3],['latPulldownWide',3],['legPress',3],['triPushdownRope',3],['hammerCurl',2],['hangingLegRaise',2] ] },
  { id:'fb_c', name:'Full Body C', code:'FULL', focus:'Fessiers · pecs haut · dos milieu',
    note:'Hip thrust en ouverture pour charger les fessiers à froid. Ensuite incliné, rowing, quadris, puis épaules/bras et mollets.', blocks:[
    ['hipThrust',4],['inclineDbPress',3],['seatedCableRow',3],['hackSquat',3],['cableLateralRaise',3],['cableCurl',2],['seatedCalf',2] ] },
];

/* Full Body 4 jours — A/B/C/D, haute fréquence, chaque muscle ~2×/semaine. */
const FULLBODY_4 = [
  { id:'fb4_a', name:'Full Body A', code:'FULL', focus:'Quadriceps · horizontal',
    note:'Squat lourd en premier. Poussée et tirage horizontaux ensuite, isolations pour finir.', blocks:[
    ['gobletSquat',4],['flatDbPress',3],['cableRowClose',3],['legExtension',3],['lateralRaiseDb',3],['triPushdownRope',2],['standingCalf',2] ] },
  { id:'fb4_b', name:'Full Body B', code:'FULL', focus:'Hinge · vertical',
    note:'Charnière de hanche d’abord (dos frais), puis développé et tirage verticaux, biceps et abdos.', blocks:[
    ['rdl',4],['dbShoulderPress',3],['latPulldownWide',3],['lyingLegCurl',3],['dbCurlSupine',3],['hangingLegRaise',3] ] },
  { id:'fb4_c', name:'Full Body C', code:'FULL', focus:'Fessiers · incliné',
    note:'Hip thrust pour les fessiers, incliné pour le haut des pecs, presse pour les quadris. Rear delts et biceps en fin.', blocks:[
    ['hipThrust',4],['inclineDbPress',3],['seatedCableRow',3],['legPress',3],['rearDeltFly',3],['hammerCurl',2],['seatedCalf',2] ] },
  { id:'fb4_d', name:'Full Body D', code:'FULL', focus:'Unilatéral · machines',
    note:'Split squat bulgare pour attaquer chaque jambe à froid. Puis poussée/tirage guidés et bras.', blocks:[
    ['bulgarianSplit',3],['machineBenchPress',3],['latPulldownNeutral',3],['walkingLunge',3],['cableLateralRaise',3],['cableCurl',2],['cableCrunch',2] ] },
];

/* PPL 5 jours — Push / Pull / Legs / Upper / Lower. Chaque muscle ~2×/semaine. */
const PPL_5 = [
  { id:'p5_push', name:'Push', code:'PUSH', focus:'Pecs · épaules · triceps',
    note:'Développé incliné en premier (ton plus lourd pour les pecs), puis militaire, machine, et isolations épaules/triceps.', blocks:[
    ['inclineDbPress',4],['dbShoulderPress',3],['machineBenchPress',3],['cableLateralRaise',3],['triPushdownRope',3],['dipsOrPushdown',2] ] },
  { id:'p5_pull', name:'Pull', code:'PULL', focus:'Dos · biceps',
    note:'Tractions d’abord : le meilleur constructeur de largeur, à faire frais. Rowing lourd ensuite, puis face pull et biceps.', blocks:[
    ['pullUp',4],['barbellRow',4],['latPulldownNeutral',3],['facePull',3],['dbCurlSupine',3],['hammerCurl',2] ] },
  { id:'p5_legs', name:'Legs', code:'LEGS', focus:'Quadriceps · ischios · mollets',
    note:'Squat en ouverture, puis soulevé roumain pour les ischios, presse, leg curl, mollets et abdos.', blocks:[
    ['gobletSquat',4],['rdl',3],['legPress',3],['lyingLegCurl',3],['standingCalf',3],['hangingLegRaise',2] ] },
  { id:'p5_upper', name:'Upper', code:'UPPER', focus:'Pecs · dos · bras',
    note:'Deuxième dose hebdo du haut : couché à plat, rowing câble, puis latérales, écartés et bras.', blocks:[
    ['flatDbPress',4],['seatedCableRow',4],['lateralRaiseDb',3],['cableFly',3],['cableCurl',2],['triUnilateralCable',2] ] },
  { id:'p5_lower', name:'Lower', code:'LOWER', focus:'Quadriceps · fessiers · ischios',
    note:'Hack squat pour les quadris à froid, hip thrust pour les fessiers, split bulgare et ischios pour finir.', blocks:[
    ['hackSquat',4],['hipThrust',3],['bulgarianSplit',3],['seatedLegCurl',3],['seatedCalf',3],['cableCrunch',2] ] },
];

/* PPL 3 jours — basse fréquence, un Push/Pull/Legs complet par semaine (agenda chargé). */
const PPL_3 = [
  { id:'p3_push', name:'Push', code:'PUSH', focus:'Pecs · épaules · triceps',
    note:'Une seule séance push par semaine : on maximise le volume. Incliné lourd d’abord, puis militaire, machine, latérales et triceps.', blocks:[
    ['inclineDbPress',4],['dbShoulderPress',3],['chestPressMachine',3],['cableLateralRaise',3],['triPushdownRope',3],['triOverheadDb',2] ] },
  { id:'p3_pull', name:'Pull', code:'PULL', focus:'Dos · biceps',
    note:'Tractions puis rowing lourd tant que tu es frais, tirage câble, face pull et deux exos de biceps.', blocks:[
    ['pullUp',4],['barbellRow',4],['cableRowClose',3],['facePull',3],['dbCurlSupine',3],['hammerCurl',2] ] },
  { id:'p3_legs', name:'Legs', code:'LEGS', focus:'Jambes complètes',
    note:'Squat et soulevé roumain en ouverture (les deux gros), puis presse et hip thrust pour les fessiers, leg curl, mollets et abdos.', blocks:[
    ['gobletSquat',4],['rdl',3],['legPress',3],['hipThrust',3],['lyingLegCurl',3],['standingCalf',3],['hangingLegRaise',2] ] },
];

/* Arnold Split 6 jours — Pecs+Dos / Épaules+Bras / Jambes, en A puis B. */
const ARNOLD_6 = [
  { id:'arn_cb_a', name:'Pecs + Dos A', code:'HAUT', focus:'Pecs · dos largeur',
    note:'Antagonistes en superset possible. Incliné et tractions/tirage d’abord (les plus lourds), puis couché, rowing, écartés, face pull.', blocks:[
    ['inclineDbPress',4],['latPulldownWide',4],['flatDbPress',3],['dbRow',3],['cableFly',3],['facePull',2] ] },
  { id:'arn_sa_a', name:'Épaules + Bras A', code:'BRAS', focus:'Deltoïdes · biceps · triceps',
    note:'Développé militaire en premier (le seul compound du jour), puis latérales et un volume de bras équilibré biceps/triceps.', blocks:[
    ['dbShoulderPress',4],['lateralRaiseDb',3],['dbCurlSupine',3],['triPushdownRope',3],['hammerCurl',2],['triOverheadDb',2] ] },
  { id:'arn_l_a', name:'Jambes A', code:'LEGS', focus:'Quadriceps',
    note:'Squat lourd à froid, puis presse et fentes pour le volume quadriceps, leg curl, mollets et abdos.', blocks:[
    ['gobletSquat',4],['legPress',3],['walkingLunge',3],['lyingLegCurl',3],['standingCalf',3],['hangingLegRaise',2] ] },
  { id:'arn_cb_b', name:'Pecs + Dos B', code:'HAUT', focus:'Pecs · dos épaisseur',
    note:'Variation machine/barre : couché machine et rowing barre lourds d’abord, puis incliné guidé, tirage assis, cross-over.', blocks:[
    ['machineBenchPress',4],['barbellRow',4],['inclineMachinePress',3],['seatedCableRow',3],['cableCrossover',3],['facePull',2] ] },
  { id:'arn_sa_b', name:'Épaules + Bras B', code:'BRAS', focus:'Deltoïdes · bras (variation)',
    note:'Développé épaules machine en ouverture, latérales câble pour la tension continue, bras en variation (incliné, dips, poulie).', blocks:[
    ['machineShoulderPress',4],['cableLateralRaise',3],['inclineDbCurl',3],['dipsOrPushdown',3],['cableCurl',2],['triUnilateralCable',2] ] },
  { id:'arn_l_b', name:'Jambes B', code:'LEGS', focus:'Ischios · fessiers',
    note:'Soulevé roumain en premier (ischios frais), hip thrust pour les fessiers, split bulgare, leg curl assis, mollets et abdos.', blocks:[
    ['rdl',4],['hipThrust',3],['bulgarianSplit',3],['seatedLegCurl',3],['seatedCalf',3],['cableCrunch',2] ] },
];

/* Bibliothèque de programmes. Chaque programme = un objectif + une fréquence + une raison
   d'être. Toutes les séances sont VARIÉES d'un jour à l'autre et couvrent, sur la semaine,
   l'ensemble des groupes musculaires. `special` = programmes liés par le repli fatigue. */
const PROGRAMS = [
  { id:'ppl6', name:'PPL 6 jours', days:'6 jours · 1 repos', mode:'Hypertrophie · avancé', special:'ppl',
    desc:'Push / Pull / Legs en A-B. La référence prise de muscle, 6 séances toutes différentes.',
    rationale:'Chaque muscle est travaillé 2×/semaine (l’optimum prouvé pour l’hypertrophie), avec assez de volume par séance sans dépasser l’heure. Idéal si tu peux t’entraîner 6 fois : c’est le meilleur rapport volume/récupération pour progresser vite.',
    sessions: PROGRAM_6 },
  { id:'ul4', name:'Upper / Lower 4 jours', days:'4 jours', mode:'Hypertrophie · intermédiaire', special:'ul',
    desc:'Haut / Bas, plus de récupération. Fusion du PPL avec 1-2 isolations en moins.',
    rationale:'4 séances, chaque muscle 2×/semaine : le meilleur compromis fréquence/récupération quand 6 jours c’est trop. Les séances haut/bas sont denses mais tiennent dans l’heure.',
    sessions: PROGRAM_4 },
  { id:'ppl5', name:'PPL + Upper/Lower 5 jours', days:'5 jours', mode:'Hypertrophie · intermédiaire+',
    desc:'Push / Pull / Legs puis Upper / Lower. Chaque muscle ~2× par semaine.',
    rationale:'Un hybride malin : la spécialisation du PPL plus une seconde dose Upper/Lower pour remonter la fréquence à 2×/muscle sans faire 6 jours. Excellent si tu vises 5 séances.',
    sessions: PPL_5 },
  { id:'fb4', name:'Full Body 4 jours', days:'4 jours', mode:'Hypertrophie · polyvalent',
    desc:'Tout le corps à chaque séance, 4 séances variées (A/B/C/D).',
    rationale:'Chaque muscle stimulé à chaque séance = fréquence élevée et volume réparti, donc peu de courbatures et une grande souplesse d’agenda. Parfait si tu peux sauter un jour sans casser le programme.',
    sessions: FULLBODY_4 },
  { id:'fb3', name:'Full Body 3 jours', days:'3 jours', mode:'Hypertrophie · débutant / temps limité',
    desc:'Tout le corps à chaque séance, 3 séances variées.',
    rationale:'Le meilleur choix quand le temps manque ou en début de parcours : 3 séances suffisent à toucher chaque muscle 3×/semaine, ce qui est très efficace à ce stade. Chaque séance est complète et tient dans l’heure.',
    sessions: FULLBODY_3 },
  { id:'ppl3', name:'PPL 3 jours', days:'3 jours', mode:'Hypertrophie · agenda chargé',
    desc:'Un Push / Pull / Legs complet par semaine.',
    rationale:'Basse fréquence assumée : chaque muscle 1×/semaine, mais avec beaucoup de volume par séance. Moins optimal que du 2×/semaine, mais le programme le plus simple à tenir quand tu n’as que 3 créneaux — et la régularité prime sur tout.',
    sessions: PPL_3 },
  { id:'arnold6', name:'Arnold Split 6 jours', days:'6 jours · 1 repos', mode:'Hypertrophie · volume élevé',
    desc:'Pecs+Dos / Épaules+Bras / Jambes, en A-B. Antagonistes ensemble.',
    rationale:'Le split volume par excellence : associer les antagonistes (pecs+dos) permet des supersets et un gros pompage, chaque groupe revenant 2×/semaine. Pour ceux qui aiment le volume et récupèrent bien.',
    sessions: ARNOLD_6 },
];

const MUSCLE_GROUPS = ['Pectoraux','Dos','Épaules','Triceps','Biceps','Quadriceps','Ischios','Fessiers','Mollets','Abdos'];

// Expose global (scripts classiques, pas de bundler — robuste sur Safari installé).
window.DATA = { BASE_EXERCISES, PROGRAM_6, PROGRAM_4, FULLBODY_3, FULLBODY_4, PPL_5, PPL_3, ARNOLD_6, PROGRAMS, MUSCLE_GROUPS };
