# CLAUDE.md — « Mes révisions »

> Contexte de projet pour Claude Code. Rédigé le 7 octobre 2026, mis à jour le 8 octobre 2026 après une session d'audit, de corrections et de refonte visuelle « Liquid Glass ».
> **En cas de désaccord entre ce document et `index.html`, c'est le code qui fait foi.** Les points incertains sont marqués **[à vérifier]**.

---

## 1. Contexte

- **Propriétaire :** Idriss, étudiant à l'Université de Nantes, en **PASS** (première année d'accès santé, concours très sélectif) avec une mineure de maths. Il n'est pas développeur : il décrit les besoins, Claude écrit tout le code.
- **Langue :** réponds **toujours en français**. Idriss dicte souvent ses messages : interprète les fautes de reconnaissance vocale avec bienveillance.
- **L'app :** « Mes révisions » (aussi « Révisions »), application web perso de **flashcards et QCM** avec répétition espacée, utilisée tous les jours pour réviser ses cours.
- **Appareils :** usage principal sur **iPad** (c'est aussi depuis l'iPad qu'il déploie), puis **iPhone**, en Safari, avec l'icône ajoutée à l'écran d'accueil. Aussi sur **Mac mini fin 2014 sous macOS Monterey, navigateur Brave** (Chromium), parfois en plein écran, parfois en demi-écran à côté d'un cours : matériel ancien, la performance compte.
- **Utilisateurs :** Idriss et **un ami**, chacun avec son propre code de synchronisation (données séparées, même projet Supabase).
- **Budget :** zéro. Offres gratuites uniquement, **pas de nom de domaine payant**.

### Règles de conduite attendues
- **Ne rien inventer.** Si une information manque, la demander.
- Ne pas se contredire d'une réponse à l'autre.
- Signaler honnêtement ce qui n'a pas pu être testé (pas d'accès à un vrai iPhone/iPad/Mac ni à Safari, synchro réelle non testable, etc.). Si un audit précédent s'est trompé, le dire.
- À la fin de chaque modification, **rappeler quels fichiers redéployer**.
- Respecter la typographie française (« 1 carte » / « 2 cartes », « 1 question juste » / « 2 justes », apostrophes, espaces).
- Quand Idriss demande une analyse « sans rien modifier », ne toucher à aucun fichier et attendre sa validation explicite, numéro par numéro.

---

## 2. Hébergement et déploiement

- **Aucun build, aucun framework, aucune dépendance npm** : tout tient dans un seul `index.html`.
- **Fichiers à déployer ensemble :** `index.html`, `apple-touch-icon.png`, `favicon.svg`, `icon-512.png`. Les icônes changent rarement ; en général seul `index.html` est à redéployer.
- **Hébergement actuel : transition Netlify → Cloudflare Pages.**
  - **Cloudflare Pages** (principal) : projet `revision-id` → `revision-id.pages.dev`. Déployé **à la main par Idriss, depuis l'iPad, par glisser-déposer** (Direct Upload, dossier ou zip). Pas de Wrangler, pas de CLI.
  - **Netlify** (ancien, projet `revisions-liquidglass` [à vérifier]) : encore en ligne le temps que l'ami migre ses données vers le site Cloudflare. Il sera supprimé ensuite.
  - Raison de la migration : l'offre gratuite Netlify (compte créé le 30/09/2026) fonctionne par crédits (300/mois, 15 par déploiement en production), trop juste pour des déploiements fréquents.
- **Dépôt GitHub** `bertoplm23/revisons--id`, branche `claude/audit-ameliorations` : historique des versions produites par Claude Code (un commit par évolution). Ce n'est **pas** un déploiement automatique : Idriss déploie toujours à la main.
- L'app n'a aucune dépendance au domaine : les fonctions Supabase ne filtrent pas par origine, donc le changement d'URL ne casse pas la synchro. Les données dépendent du **code de synchro**, pas du site.
- **Livrable attendu :** le `index.html` final, prêt à glisser dans Cloudflare Pages. Si plusieurs fichiers changent, un zip des 4 fichiers est pratique pour un dépôt depuis l'iPad.
- Après un redéploiement, si l'app installée sur l'écran d'accueil affiche encore l'ancienne version : la fermer complètement (balayer vers le haut dans le sélecteur d'apps) puis la rouvrir.

---

## 3. Architecture du code

- `index.html` (≈ 290 Ko) : CSS + **10 balises `<script>` inline**. Le fichier contient des images `data:` en base64 : **ne pas le lire en entier**, utiliser `grep -n` et des plages de lignes, en ignorant le base64.
- **Premier script = cœur de l'app :**
  - `S` : état global (`S.nodes` = dossiers `f`, paquets `fc`/`qcm`, images `img`, journaux de révision `log-<appareil>`, nœud d'options `opt`).
  - `A` : objet d'actions, appelées via les attributs `data-a` / `data-v` par **un écouteur de clic unique**. Un clic dans une feuille d'actions (`#asd`) remet `AS=null` avant l'action : une action qui doit garder la feuille ouverte doit réaffecter `AS` (ex. `A.fxo`, `A.fxe`).
  - `cfg` : réglages, persistés en localStorage (`revis-cfg`). Clés notables : `srs`, `nl`, `rt`, `vw`, `so`, `ipad`, `cp` (compact), `fs` (taille du texte), `an` (avance auto), `fc` (prévision), `gl` (transparence du verre), `sb` (panneau latéral), `code` (synchro), **`nolt`** (lumière sous le doigt désactivée), **`nosk`** (série du jour masquée).
  - `render()` est un **enveloppe** de `render0()` : il ouvre un mémo `RM` le temps d'un rendu (enfants de chaque dossier et compteurs « à revoir / nouvelles » via `cnN(n)`), puis le referme. `render0()` **reconstruit tout le DOM de `#app` à chaque action** (pas de DOM virtuel) : une référence à un élément devient obsolète après un clic qui déclenche un rendu.
  - `G(id)` utilise un **index** (id → position dans `S.nodes`) reconstruit quand le tableau change, et chaque résultat est revérifié (remplacement sur place). Ne pas réintroduire de cache sans cette vérification.
  - `PR` : constante contenant le prompt de génération de cartes (voir §7).
  - `sync()` : synchronisation Supabase (voir §4).
- **Scripts suivants : ils complètent ou SURCHARGENT `A` et `render`** (Liquid Glass, annulation de note, édition de cartes, mode examen en arbre, recherche avancée, micro-interactions, couleur d'accent…), et une dizaine de `MutationObserver` retouchent le DOM après chaque rendu. Des fonctions comme `A.rate`, `A.imp`, `A.add`, `A.undo`, `A.search` sont redéfinies plus loin. **Avant de modifier un comportement, cherche toutes ses définitions dans le fichier** : modifier la première peut n'avoir aucun effet si une autre la remplace ensuite. (Une refonte de cette architecture a été proposée et **refusée** : voir §8.)
- **Le CSS Liquid Glass récent est ajouté en blocs à la fin de la balise `<style>`**, dans cet ordre : étape 1 (`.liquid-card`, `.liquid-btn`), étape 2 (notes, QCM, accueil, barre du bas), étape 3 (harmonisation du reste), puis le bloc Mac (`html[data-desk="1"]`). Un script plus loin **injecte encore du CSS au chargement** (couleur d'accent, reflets d'eau) : les règles récentes utilisent le préfixe `#app` ou des sélecteurs doublés pour passer devant.
- Attributs posés sur `<html>` au démarrage : `data-theme`, `data-ipad`, `data-dens`, `data-fs`, `data-sb`, `class="nolt"`, et **`data-desk`** (`setDesk()` : `"1"` si souris/trackpad **et** aucun écran tactile, donc Mac ; jamais sur iPad, même avec clavier/trackpad).
- Les Réglages sont regroupés en trois `<section class="sgc">` (Révision, Affichage, Données) dans `.sgrid`, et le haut des Statistiques dans `.stg` : garder ces enveloppes en modifiant ces écrans (elles portent la mise en page en colonnes).
- Codes de type internes : `fc` (flashcards), `qcm`. Champs d'une carte : `q`, `a` (fc), `o` (propositions QCM), `e` (explication), `qi`/`ai` (images), progression `st,s,df,l,k,d,b,n,m,t,f`, et **`fx: 1`** = marquée « à corriger ».

### Stockage local
- **localStorage** : `revis-v2` (copie de secours des données, si < 1,5 Mo), `revis-cfg`, `revis-theme`, `revis-accent`, `revis-new`, `revis-last`, `revis-bk`, `revis-up` (images déjà envoyées/supprimées), `revis-sy2` (état de la synchro par nœud), `revis-exam` (examen en cours), `revis-pace`, `revis-dev` (identifiant de l'appareil), `revis-codeok`, `revis-v1` (ancien format, lu seulement pour la démo).
- **IndexedDB** : `revis-data` (stockage principal des données, clé `S`) et `revis-img` (images des cartes).

---

## 4. Supabase

- **Projet dédié « Mes révisions », ID `yjhkaecnjyyhhbjjospa`.** Ne jamais toucher au projet de l'autre app d'Idriss, « Suivi J ».
- Offre gratuite : 500 Mo de base pour tout le projet (partagés avec l'ami), 5 Go de transfert/mois, **mise en pause après 7 jours sans activité** (l'app ne synchronise plus tant qu'on ne relance pas le projet depuis le tableau de bord, bouton « Restore »).
- **Sécurité :** le code de synchro est la seule protection. Le serveur stocke `code_hash` = SHA-256 de `"revis:" + code` (vérifié dans le code). La clé publique (anon) est dans `index.html`.

### Modèle de sécurité (à respecter pour toute évolution)
- RLS activée sur toutes les tables, **aucun accès direct pour `anon`/`authenticated`, aucun `grant` sur les tables**.
- Tout passe par des **fonctions `security definer` avec `set search_path to 'public'`**, et seules ces fonctions reçoivent un `grant execute`.
- Migrations via le MCP Supabase : `apply_migration` exige un `name` (slug) et un `query` (SQL complet).
- Pour tester une fonction : insert/select/delete **dans un seul appel `execute_sql`**, avec vérification du nettoyage dans le même appel.

### État de la base (vérifié le 07/10/2026)

| Table | Clé primaire | Colonnes | Rôle |
|---|---|---|---|
| `revis_sync` | `code_hash` | `data jsonb`, `updated_at` | Ancienne synchro : un blob JSON complet par code. 5 codes y ont des données. |
| `revis_node` | `code_hash, id` | `data jsonb`, `u bigint`, `rev bigint`, `updated_at` | Synchro **nœud par nœud** (dossier/paquet) : **c'est la synchro active**. |
| `revis_img` | `code_hash, id` | `data text`, `updated_at` | Images (une ligne par image). Quota 2 000 images par code. |

Fonctions (toutes `security definer`, `search_path=public`, exécutables par `anon` et `authenticated`) :
- `revis_pull(p_hash)` → jsonb · `revis_push(p_hash, p_data jsonb)` · `revis_ver(p_hash)` → text
- `revis_n_pull(p_hash, p_since bigint)` → jsonb · `revis_n_push(p_hash, p_nodes jsonb)` → bigint · `revis_n_ver(p_hash)` → text
- `revis_img_put(p_hash, p_id, p_data)` · `revis_img_get(p_hash, p_ids text[])` · `revis_img_del(p_hash, p_ids text[])`

**Migration automatique (vérifié le 07/10/2026 en lisant les fonctions) :** au premier `revis_n_pull` d'un code absent de `revis_node`, le serveur copie ses nœuds depuis `revis_sync` ; `revis_n_ver` renvoie `"0"` pour un code connu seulement de `revis_sync`. La copie n'a lieu **qu'une fois** : si une ancienne version de l'app continue ensuite d'écrire dans `revis_sync`, ces écritures ne seront plus vues par la nouvelle. Côté app, `sync1()` (ancienne synchro par blob) ne sert plus que si `revis_n_pull` répond 404.

### Comportement de la synchro dans l'app
- Après une modification : envoi 0,6 s plus tard (1,5 s en révision/examen). Au retour dans l'app : synchro immédiate.
- Détection des changements faits ailleurs : canal temps réel (WebSocket Supabase) ; à défaut, `revis_n_ver` est interrogé **toutes les 20 s** (30 s si le temps réel marche). C'était toutes les 2 s avant le 07/10/2026.
- **Témoin de synchro** dans la barre du haut de l'accueil (nuage : ✓ synchronisé, points = en cours, ! = échec ; ailleurs, il n'apparaît qu'en cas d'échec). Le toucher lance une synchro, ou ouvre les Réglages en cas d'échec.
- Messages d'erreur : hors ligne (`navigator.onLine === false`) → « Pas de connexion Internet… » ; **après 2 échecs consécutifs avec réseau** → explication de la mise en pause du projet gratuit et du bouton « Restore » ; 4xx → données trop volumineuses ?

### Pièges connus
- `revis_push` échoue **silencieusement** au-delà d'environ **4 Mo** de données : c'est pour ça que les images passent par des appels séparés et que l'envoi par nœud se fait par lots (300 nœuds ou ~1,5 Mo).
- Une **fusion carte par carte** existe pour ne pas perdre de progression quand le même paquet est révisé sur deux appareils avant synchro : le contenu d'un paquet suit la version la plus récente (`u`), la progression de chaque carte suit la révision la plus récente. Toute modification de la synchro doit préserver ce comportement. Un changement de contenu (édition, drapeau `fx`) doit mettre à jour `u` du paquet.
- Taille réelle constatée : export JSON d'Idriss ≈ 195 Ko (sans images), paquets typiques de ~35 flashcards ou ~15 QCM. L'historique de révision grossit avec le temps.

---

## 5. Fonctionnalités existantes

### Organisation
- Dossiers et sous-dossiers ; **3 modes d'affichage** : liste, icônes, colonnes (colonnes **uniquement sur grand écran**).
- Fil d'Ariane déroulant ; panneau latéral (iPad et Mac) avec défilement indépendant et bouton pour le masquer.
- **Glisser-déposer entre dossiers (iPad)**.
- Épingler dossiers/paquets sur l'accueil ; tri (nom naturel, récent, à réviser, manuel avec réorganisation par glisser).
- Masquer dossiers/paquets (exclus de « Tout réviser » et du mode examen, mais révisables).
- Corbeille (30 jours, restauration/purge) ; annulation.
- Actions sur un paquet : dupliquer, fusionner, réinitialiser la progression. Menus par élément sous forme de feuilles d'actions.
- Couleurs de dossier : 18 couleurs + sélecteur libre.

### Accueil
- **Encadré « série et objectif du jour »** : jours d'affilée (tous appareils, depuis les journaux de révision), révisions faites et restantes, barre de progression. Désactivable (Réglages › « Série et objectif du jour », `cfg.nosk`).
- Carte « Reprendre », carte « À corriger » (si des cartes sont marquées), rappels (sauvegarde, code de synchro, retard, date d'examen).

### Révision
- **Répétition espacée FSRS-5** (comme Anki), désactivable. 4 boutons : **À revoir, Difficile, Bien, Facile** (le bouton « Difficile » n'a volontairement pas d'icône).
- Limite quotidienne de nouvelles cartes, séparation nouvelles/révisions ; fenêtre de choix au lancement (nouvelles / à réviser / les deux).
- **Révision libre** : réviser sans toucher à la progression, aux statistiques ni au planning FSRS.
- Flashcards : retournement animé, **glissement de la carte pour noter**, annulation de la dernière note (Ctrl+Z).
- En-tête de révision : modifier la carte, **drapeau « à corriger »**, supprimer (avec toast « Annuler » 8 s).
- **« À corriger »** (`fx: 1` sur la carte) : drapeau pendant la révision (flashcards, QCM, examen) ; liste depuis l'accueil, avec « Modifier » (la carte sort de la liste dès qu'on enregistre) et « Retirer ».

### QCM
- 5 propositions, une explication par question affichée après validation.
- Double-tap sur une proposition pour valider ; passage automatique à la question suivante après un sans-faute (1,5 s) ; « J'ai hésité » note comme difficile.
- **Mode examen chronométré**, avec sélection en arbre (dossiers → paquets → questions, cases à trois états ; QCM uniquement), reprise d'un examen interrompu.

### Recherche, statistiques, données
- Recherche globale (dossiers, paquets, cartes, questions) avec filtres : type, à réviser, souvent ratées, portée par dossier.
- Statistiques : compteur du jour, heatmap, graphique de prévision, mémorisation réelle, taux de réussite par dossier, onglet « À revoir souvent ».
- Export / restauration JSON, avec rappel de sauvegarde périodique.
- Images dans les cartes (IndexedDB + `revis_img`).

### Réglages notables
- Couleur de contraste (6 teintes + libre), ajustée au thème pour rester lisible. **Corrigé le 07/10/2026** : elle n'était réappliquée qu'à l'ouverture des Réglages ; elle l'est maintenant dès le lancement, avant la mise en place du fondu de couleur.
- « Lumière sous le doigt » (désactivable, `cfg.nolt`), transparence du verre, taille du texte, affichage compact, mise en page iPad.

### Raccourcis clavier
Espace/Entrée/flèches/1-4 pour retourner et noter, Ctrl+Z pour annuler ; lettres pour choisir en QCM/examen et Entrée pour valider/avancer ; Échap pour fermer feuilles et menus ; Entrée / Ctrl+Entrée pour valider un nom ou une édition.

---

## 6. Direction artistique : Liquid Glass

- Sobre, moderne, **proche de l'interface de Claude** : thème chaud **crème / anthracite**, accent **terracotta** (`#b5573a` clair, `#e08a6a` sombre ; `#c96a48` dans l'icône). Mode clair et sombre. Garder la cohérence visuelle à chaque ajout.
- Style **« Liquid Glass » inspiré d'iOS 27**, approuvé par Idriss le 07/10/2026, construit en trois étapes. Toute l'interface repose sur **trois matières** :
  - **panneau de verre** : fond légèrement givré (`--lq-panel`, `--lq-row-fill`), lumière en haut (`--lq-drop-gl`), liseré clair en haut à gauche et plus dense en bas à droite (`border-color: var(--lq-edge-hi) var(--lq-rim) var(--lq-rim) var(--lq-edge-hi)`) ;
  - **goutte** (boutons, puces, propositions, résultats) : même matière en relief, ombres internes, **onde au toucher** (`::after`, partant du doigt via `--gx/--gy` posées par la « lumière sous le doigt ») et **déformation organique** au toucher (`border-radius` asymétrique, bref) ; les boutons d'action sont des gouttes terracotta ;
  - **creux** (champs, plateaux de boutons, contrôle segmenté) : liseré inversé et ombre intérieure (`--lq-well`).
- Composants de référence : `.liquid-card` (flashcard) et `.liquid-btn` (bouton « Réviser » de l'accueil, seul élément qui **flotte**, en `translate`).
- **Règles impératives :**
  - **Le contraste du texte ne doit jamais baisser** (surtout flashcards et QCM). Méthode : mesurer les pixels réels derrière chaque texte, avant/après, iPhone et iPad, clair et sombre (voir §9). En sombre, les gouttes doivent rester foncées ; un halo clair ne passe jamais derrière du texte.
  - **Aucune animation en continu d'une propriété coûteuse** (background-position, filter, border-radius…). Les anciens reflets animés « Tide » et « Glint » (accueil, statistiques) sont figés. Seuls restent animés : le fond (rotation composée par le GPU, figé sur Mac) et le flottement du bouton « Réviser ».
  - **Flou (`backdrop-filter`) seulement sur les grands éléments uniques** : flashcard, question QCM en révision, barre du bas, feuilles. Jamais sur les listes (dossiers, propositions, boutons). Coupé pendant le glissement d'une carte.
  - Un liseré en dégradé posé en `border-box` sous un fond translucide teinte tout l'intérieur : pour les gouttes, utiliser la bordure à quatre couleurs.
- Gérer les **safe-area insets** iOS (un bug de défilement au-delà du contenu a déjà été corrigé sur ce point).
- L'icône : deux feuilles crème inclinées sur fond anthracite, deux lignes de texte et une coche terracotta.

### Adaptation par appareil
- **iPhone** (< 768 px) : mise en page téléphone. Sur 320 px, en révision, le mot « Retour » est masqué visuellement (chevron seul) quand le drapeau est présent.
- **iPad** (≥ 768 px, `cfg.ipad`) : panneau latéral, grille, textes et boutons agrandis pour le doigt.
- **Mac** (`html[data-desk="1"]`, ajouté le 08/10/2026) : tailles pensées pour la souris ; dossiers sur 1 colonne (768–1 099 px), 2 colonnes, ou 3 (≥ 1 500 px) ; en révision/examen, boutons juste sous la carte à toutes les largeurs ; consignes clavier à la place de « Touche » / « Glisse la carte », et touche 1 à 4 affichée sur chaque bouton de note ; **effets allégés pour le Mac mini 2014** (aucun flou en temps réel, fond immobile, réfraction SVG de la barre du bas coupée, surfaces flottantes opaques). Panneau latéral masqué (`data-sb="0"`) : le contenu reprend toute la largeur (bug corrigé le 08/10/2026 : il restait coincé dans la colonne de 240 px du panneau).
- **Grands écrans (fenêtre ≥ 1 100 px : Mac, iPad en paysage)** : chaque écran utilise la largeur disponible (Idriss a refusé la colonne étroite centrée de 760 px). Réglages en sections côte à côte (`.sgrid` > `.sgc`, 2 colonnes, 3 au-delà de 1 500 px) ; Statistiques en grille (`.stg` : compteur du jour | calendrier, mémorisation | prévision ; dossiers sur 2 colonnes) ; recherche et contenu d'un paquet sur 2 colonnes ; révision/examen dans une colonne de 960 px avec une carte plus grande ; configuration d'examen 920 px. En dessous de 1 100 px, tout reste comme avant (iPhone et iPad en portrait vérifiés identiques au pixel près).

---

## 7. Import et prompt `PR`

- Assistant en 2 étapes : (1) copier le prompt `PR`, y coller son cours et l'envoyer à une IA ; (2) coller la réponse dans l'app (bouton « Coller depuis le presse-papiers », aperçu en direct). Le bouton « Suivant » de l'étape 1 permet déjà de passer directement au collage.
- « Copier le prompt » utilise `navigator.clipboard.writeText`, avec repli sur `execCommand` et un message si la copie échoue.
- `PR` est rédigé pour le niveau PASS : rôle d'expert en pédagogie médicale, **zéro hallucination**, **règle de l'atome** (une information par carte), vocabulaire universitaire exact.
- **Quantité : au maximum 60 flashcards et 40 QCM**, adaptée à la richesse du cours. Chaque mot en **gras** du cours doit apparaître dans au moins une carte. Pour un long cours, l'envoyer en plusieurs parties.
- **Format de sortie strict, lisible par la machine (ne pas le casser, le parseur en dépend) :**
  - Flashcards : `Question ; Réponse` (une par ligne).
  - QCM : `Q: énoncé`, puis 5 propositions, une par ligne, avec `*` collé à la fin des vraies, puis `E: explication`.
  - Interdits : blocs de code markdown, puces, numérotation, texte d'introduction ou de conclusion.
- **Réponse mixte : reconnue automatiquement** (`parseAll`) ; elle crée deux paquets « Nom · Flashcards » et « Nom · QCM ».
- Parseur : un QCM sans ligne `E:` se termine à la première ligne « question ; réponse » qui suit ses 5 propositions (corrigé le 07/10/2026 ; avant, les flashcards suivantes étaient avalées comme propositions).
- Ajout dans un **paquet existant** : une carte dont la question existe déjà dans le paquet est **ignorée volontairement** (« doublon ignoré »).

---

## 8. À ne pas réintroduire ni reproposer

| Élément | Raison |
|---|---|
| « Schéma » (occlusion d'image) | Inutile et buggé, retiré entièrement. |
| Glissement sur les **lignes de liste** pour révéler des actions | Conflit avec le glisser-déposer entre dossiers sur un vrai iPad (carte fantôme bloquée). À ne pas confondre avec le glissement des **flashcards** pour noter, qui est conservé. |
| View Transitions (navigation animée entre vues) | Jugées peu naturelles, alourdissent et complexifient l'interface. |
| PWA / cache hors ligne / service worker | Refusé. Ne pas reproposer sauf demande explicite. |
| Ajout de dépendance externe ou d'étape de build | Tout reste dans un seul `index.html`. |
| Nom de domaine payant | Refusé. |
| Bouton « J'ai déjà la réponse » à l'import | Doublon du bouton « Suivant » de l'étape 1. |
| Instantanés quotidiens des données côté serveur | Refusé (07/10/2026). |
| Refonte des 10 scripts / `MutationObserver` en un seul passage | Refusée (07/10/2026) : trop risquée. |
| Flottement de la flashcard | Une animation de `transform` prend le pas sur le glissement pour noter et le bloquerait. |

---

## 9. Méthode de travail

1. **Partir du dernier `index.html`** fourni par Idriss (ou du dernier commit de la branche), jamais d'une version supposée.
2. **Lire les parties concernées** (`grep -n`, plages de lignes ; ignorer le base64). Chercher les surcharges de la fonction visée dans les scripts suivants, et les styles injectés par script.
3. **Modifier avec des scripts de patch Python** qui échouent si le texte cherché n'apparaît pas exactement une fois :
   ```python
   def rep(old, new, n=1):
       global s
       assert s.count(old) == n, (old[:60], s.count(old))
       s = s.replace(old, new)
   ```
4. **Vérifier la syntaxe** : extraire chaque `<script>` inline dans un fichier `.js` et lancer `node --check` sur chacun.
5. **Tester la logique** avec des scripts Node.js (FSRS, fusion de synchro, parseur d'import…), en comparant l'ancienne et la nouvelle version.
6. **Tester dans le navigateur avec Playwright** (Chromium dans `/opt/pw-browsers`) :
   - iPhone (390 px, et 320 px pour les petits écrans), iPad (1024 px, portrait et paysage) : `hasTouch:true, isMobile:true` ;
   - Mac : **sans** `hasTouch`/`isMobile` (sinon `data-desk` reste à `"0"`), 1440×900, 1920×1080, et des fenêtres moyennes (960 px) et étroites (700 px) ;
   - **tous les états de mise en page** : panneau latéral affiché **et masqué** (`cfg.sb`, bouton `A.sbt`), vues liste / icônes / colonnes ;
   - clair et sombre, erreurs console, **débordement horizontal**, gestes fins via CDP (`Input.dispatchTouchEvent`), re-sélection des éléments après chaque rendu ;
   - synchro simulée en interceptant `**/rest/v1/rpc/**` (y compris des changements « venus d'un autre appareil » et des échecs réseau) ;
   - jeu de données synthétique réaliste (~100 nœuds, ~2 000 cartes, 90 jours d'historique) ;
   - parcours complet de toutes les fonctions avec contrôle de cohérence des données après chaque étape, puis tests aléatoires de type « monkey » (centaines de touches) ;
   - pièges : deux actions dans le même instant font un `history.back()` qui peut quitter la page (artefact de test) ; l'émulation tactile ne déclenche pas `:active` (tester l'appui à la souris).
7. **Mesurer le contraste** pour toute retouche visuelle : capture normale + capture avec tout le texte transparent, puis ratio WCAG texte/fond pixel par pixel, avant/après, sur chaque écran. Aucun texte ne doit passer sous 4,5:1 ni baisser s'il y était déjà.
8. **Contrôler visuellement par captures d'écran.** Sous Linux, les polices de repli sont plus larges que SF/Georgia sur iOS : ne pas conclure à un bug de largeur sans recouper. Pour vérifier qu'un changement n'affecte pas un appareil, comparer les captures au pixel près (animations en pause ou `reducedMotion`).
9. **Livrer** le `index.html` final, rappeler les fichiers à redéployer, et enregistrer un commit sur la branche.

- **Autonomie :** implémenter de bout en bout sans demander de valider chaque étape. Pour une grosse évolution UX, poser d'abord des questions ciblées, puis cibler **une vue précise** plutôt que tout retoucher ; procéder par étapes (composant de test, puis extension).
- **Capture d'écran d'un bug** envoyée par Idriss : corriger **ce bug précis**, sans refonte annexe.
- Idriss apprécie des tests poussés avant livraison et une liste honnête de ce qui n'a pas été vérifié.
- **Zones sensibles** (une erreur abîme les données, pas seulement l'affichage) : FSRS, fusion de synchro, migrations Supabase, parseur d'import, export/restauration.
- Recommandation de modèle donnée à Idriss : Opus pour l'analyse et les changements touchant FSRS, la synchro, Supabase ou une refonte visuelle ; Sonnet pour les petites retouches (texte, CSS, bug sur capture).

---

## 10. Limites et bugs connus

- **Glissement des flashcards** : nettement amélioré, mais pas parfait en simulation (≈ 30/36 gestes difficiles réussis sur iPad, 32/36 sur iPhone au 05/10/2026). À surveiller sur appareil réel.
- Après suppression d'une carte en révision, « annuler la dernière note » est désactivé (l'ordre des cartes a changé).
- Les tests automatisés ne reproduisent pas tout le comportement d'un vrai doigt sur iPad (c'est ce qui avait masqué le bug du glissement sur les lignes).
- Synchro réelle entre deux appareils non testable en local (seulement simulée). La réponse exacte de Supabase quand le projet est en pause n'a pas été observée : le message s'appuie sur les échecs répétés.
- Liquid Glass et adaptation Mac : vérifiés uniquement dans Chromium (Playwright), ni sur Safari iOS ni sur le vrai Mac mini 2014 ; fluidité réelle non mesurée.
- Supabase gratuit : pause après 7 jours d'inactivité ; 2 projets actifs maximum par organisation (Idriss en a déjà deux : « Suivi J » et « Mes révisions »).
- 3 règles CSS sont propres à Firefox (`-moz-range-*`) : ignorées ailleurs, sans effet.
- Vérification générale du 07/10/2026 (parcours complet, cas limites, 5 400 actions aléatoires sur iPhone et iPad) : aucun autre bug trouvé.

---

## 11. En cours / pistes

- **Migration de l'ami** de Netlify vers Cloudflare Pages (pas encore faite au 08/10/2026) : il doit noter son code de synchro et idéalement exporter un JSON avant de basculer. **Une fois passé sur Cloudflare, il ne doit plus jamais utiliser le site Netlify** (la copie `revis_sync` → `revis_node` n'a lieu qu'une fois, voir §4). Les deux sites restent en ligne jusqu'à ce qu'il confirme ; ensuite, suppression du site Netlify.
- **Après la fermeture de Netlify seulement** : nettoyage possible du code mort (ancienne synchro `sync1`/`revis_sync`, intervalles fixes 1/3/7/14/30, données de démonstration sur la méiose). Idriss l'a refusé pour l'instant : ne le faire que sur sa demande.
- Retours attendus d'Idriss sur appareil réel : intensité du Liquid Glass (flottement, onde, verre), fluidité sur le Mac mini, défilement de l'accueil avec beaucoup de dossiers.
