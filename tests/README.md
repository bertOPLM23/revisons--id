# Tests de rev.

Ce dossier **ne se déploie pas** : il ne fait pas partie des 8 fichiers du site.

- Lancer tous les tests : `node tests/run.js`
- Lancer un test précis : `node tests/run.js a1`

## Principe

- Chromium est piloté par Playwright, qui est déjà installé sur la machine de développement. Aucune dépendance n'est ajoutée au projet.
- Seules des données fictives sont utilisées (`lib/data.js`).
- Le serveur Supabase est simulé (`lib/h.js`). Il copie fidèlement `revis_n_pull`, `revis_n_push` et `revis_n_ver`, dont les définitions ont été lues le 21/10/2026.
- **Ordre des clés JSON** (24/10/2026, B1) : PostgreSQL `jsonb` réordonne les clés de tous les objets (courtes d'abord, puis alphabétique), y compris dans les tableaux. Le serveur simulé sait l'imiter : `H.server({ jsonb: true })` / `M.setup({ jsonb: true })`, ou `REV_JSONB=1 node tests/run.js` pour toute une exécution. **Lancer la suite dans les deux modes** (sans et avec `REV_JSONB=1`) avant toute livraison touchant la synchronisation : le mode historique (ordre conservé) avait caché B1.
- Rien ne sort sur le réseau : les requêtes sont bloquées et le WebSocket est désactivé.
- Chaque « appareil » est un contexte de navigateur isolé, avec son propre stockage et éventuellement une horloge décalée.

## Fichiers

| Fichier | Risque surveillé |
|---|---|
| `t-fsrs.js` | Régression du calcul FSRS : il doit rester identique à `fsrs-reference.json`, enregistrée sur la version `1f6cb44`. Vérifie aussi les invariants sur 60 000 notes. |
| `t-sim45.js` | Cohérence entre progression, journal et compteurs sur 45 jours simulés. |
| `t-a1-seance.js` | Perte de cartes ajoutées ou modifiées ailleurs pendant une séance ; synchros répétées. |
| `t-a1-fusion.js` | A1 : fusion du contenu à trois versions (ajouts, corrections, suppressions des deux appareils, hors ligne, deux ordres de reconnexion) ; suppression jamais annulée ; conflits (même carte, même question) avec copie de récupération `conflit-contenu` ; conflits avec remise à zéro et restauration (A2) ; coupures de connexion (envoi échoué, retours croisés) ; base `S.baseH` (instantané, absence de base) ; paquet ouvert en séance (ajouts adoptés, suppressions et corrections différées). |
| `t-a1-fuzz.js` | A1 : tirages pseudo-aléatoires rejouables (5 graines fixes) d'ajouts, corrections, suppressions, notes et envois échoués sur deux appareils ; convergence, aucun doublon, aucune perte, aucune résurrection, 0 écriture au repos. |
| `t-b1-jsonb.js` | B1 : invariance à l'ordre des clés JSON. Fonctions pures (`cj`, `chash` : flashcard, QCM `{t,k}`/`{k,t}`, imbrication profonde, ordre des tableaux, valeurs JSON, empreintes historiques) ; synchro sans changement = 0 écriture et `u` inchangé ; QCM en séance jamais mis en attente par le retour de son propre envoi ; vrais changements (texte de proposition, bonne réponse, explication, ajout, suppression, conflit, remise à zéro) détectés dans les deux modes du serveur ; version du format des empreintes (`BHV`). Les scénarios fixent eux-mêmes le mode du serveur. |
| `t-a2-generation.js` | Réinitialisation ou restauration annulée par la synchro (cas de base). |
| `t-a2-generations.js` | A2 : générations `gn`/`gw`/`gc`, copie de récupération locale (`REC`), `S.base`, anciens clients (`b91e359`) avec horloges +24 h / 0 / −1 h, horloges décalées, paquet ouvert en séance, échecs de stockage, redémarrage. |
| `t-ev.js`, `t-drapeaux.js`, `t-journaux.js`, `t-hlc.js` | `ev` d'examen, drapeaux seuls, journaux, horloge hybride. |
| `t-a3-annuler.js` | Annulation et « J'ai hésité » défaits par l'écho serveur. |
| `t-a4-qcm.js` | QCM validé sans réponse. |
| `t-a5-examen.js` | L'examen ne doit pas modifier FSRS, ni directement ni par la synchro. |
| `t-a6-jour.js` | Bascule de la journée à 4 h ; compteurs au retour au premier plan. |
| `t-a6-effets.js` | A6 (suite) : bornes 23:59 / 00:00 / 03:59 / 04:00, fins de mois et d'année, 29 février, changements d'heure, 4 fuseaux, journal, échéances et écoulé FSRS, série, limite de nouvelles cartes, calendrier d'activité, redessin à la bascule (jamais en séance). |
| `t-j8.js` | Plafond d'examen à J-8 (25/10/2026) : aucune carte en révision après J-8, seule la date `d` change (s, df, l, t, contenu intacts), fenêtre des 8 derniers jours (« Dispo. »), répartition des plus faciles sur les jours précédents, jamais avant aujourd'hui, deux appareils identiques, 0 écriture au repos. Le plafond est calculé localement : le serveur garde les dates d'origine. |
| `t-son.js` | Effets sonores (25/10/2026) : désactivés par défaut, aucun contexte audio créé tant que c'est coupé, réglages (interrupteur, volume borné, catégories), sons QCM juste/faux, boutons, panneaux, aucun son au retournement, réglage synchronisé vers l'autre appareil, aucune écriture au repos. |
| `t-horloges.js` | Horloge décalée, ordre de reconnexion, écho retardé ; 0 écriture au repos. |

## Lire les résultats

- `CONNU` : un risque déjà identifié, hors du périmètre des corrections en cours. Il est affiché mais n'est pas compté comme un échec.
- `node tests/t-fsrs.js --update` réenregistre la référence FSRS. Ne le faire que pour un changement **volontaire** du calcul.

`REV_HTML=<fichier> node tests/run.js <motif>` rejoue un test sur une autre version du site (ex. `git show c4dfa44:index.html > /tmp/v.html`) : sert à vérifier qu'un nouveau test échoue bien sur la version antérieure.
