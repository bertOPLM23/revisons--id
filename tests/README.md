# Tests de rev.

Ce dossier **ne se déploie pas** : il ne fait pas partie des 8 fichiers du site.

- Lancer tous les tests : `node tests/run.js`
- Lancer un test précis : `node tests/run.js a1`

## Principe

- Chromium est piloté par Playwright, qui est déjà installé sur la machine de développement. Aucune dépendance n'est ajoutée au projet.
- Seules des données fictives sont utilisées (`lib/data.js`).
- Le serveur Supabase est simulé (`lib/h.js`). Il copie fidèlement `revis_n_pull`, `revis_n_push` et `revis_n_ver`, dont les définitions ont été lues le 21/10/2026.
- Rien ne sort sur le réseau : les requêtes sont bloquées et le WebSocket est désactivé.
- Chaque « appareil » est un contexte de navigateur isolé, avec son propre stockage et éventuellement une horloge décalée.

## Fichiers

| Fichier | Risque surveillé |
|---|---|
| `t-fsrs.js` | Régression du calcul FSRS : il doit rester identique à `fsrs-reference.json`, enregistrée sur la version `1f6cb44`. Vérifie aussi les invariants sur 60 000 notes. |
| `t-sim45.js` | Cohérence entre progression, journal et compteurs sur 45 jours simulés. |
| `t-a1-seance.js` | Perte de cartes ajoutées ou modifiées ailleurs pendant une séance ; synchros répétées. |
| `t-a2-generation.js` | Réinitialisation ou restauration annulée par la synchro ; écrasement par une ancienne version. |
| `t-a3-annuler.js` | Annulation et « J'ai hésité » défaits par l'écho serveur. |
| `t-a4-qcm.js` | QCM validé sans réponse. |
| `t-a5-examen.js` | L'examen ne doit pas modifier FSRS, ni directement ni par la synchro. |
| `t-a6-jour.js` | Bascule de la journée à 4 h ; compteurs au retour au premier plan. |
| `t-horloges.js` | Horloge décalée, ordre de reconnexion, écho retardé ; 0 écriture au repos. |

## Lire les résultats

- `CONNU` : un risque déjà identifié, hors du périmètre des corrections en cours. Il est affiché mais n'est pas compté comme un échec.
- `node tests/t-fsrs.js --update` réenregistre la référence FSRS. Ne le faire que pour un changement **volontaire** du calcul.
