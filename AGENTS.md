# AGENT.md — Plan de travail (Codex Agent) — Application Contacts (con)

## 0) Objectif
Construire une application **Contacts** (monorepo) sur le modèle du **GestionnaireMDP** :
- même style visuel (UI/CSS, layout, patterns)
- même conventions d’infrastructure (“invariants”)
- DEV sur laptop via `docker compose`
- Stack : **PostgreSQL + API Node/Express + Frontend React/Vite**

L’application gère :
1) **Contacts publics** (en clair en base)
2) **Contacts privés** (chiffrés bout-en-bout : le backend ne voit jamais les données en clair)

---

## 1) Invariants obligatoires (NE PAS DÉVIER)
### Identité app
- `APP_SLUG=con`
- `APP_DEPOT=contact`
- `APP_NO=4`

### Ports DEV (règles invariants)
Avec `APP_NO=4` :
- DB : `DEV_DB_PORT=5436` (5432 + 4)
- Frontend : `DEV_VITE_PORT=5177` (5173 + 4)
- API : `DEV_API_PORT=8005` (8000 + (4+1))

### Postgres (standard)
- `POSTGRES_USER=${APP_SLUG}_pg_user` → `con_pg_user`
- `POSTGRES_DB=${APP_SLUG}_pg_db` → `con_pg_db`
- `POSTGRES_PASSWORD` est un secret (dans `.env.local` seulement)

### Docker compose (commandes)
Toujours proposer/suivre :
- `docker compose -f docker-compose.dev.yml --env-file .env.dev up -d --build`
- `docker compose -f docker-compose.dev.yml --env-file .env.dev ps`
- `docker compose -f docker-compose.dev.yml --env-file .env.dev logs -f <service>`

### Secrets
- Un seul fichier secret : `.env.local` (NON commité)
- `.env.dev` / `.env.prod` : commitable, **sans secrets**
- Fournir `.env.local.example` (placeholders seulement)
- Fournir `.gitignore` qui ignore `.env.local` + artifacts sensibles

### Services Compose (noms et structure)
Services standards : `db`, `backend`, `frontend`

---

## 2) Architecture repo (monorepo)
Créer la structure suivante :

contact/
├── backend/                 # Node/Express API
│   ├── src/
│   ├── package.json
│   ├── Dockerfile.dev
│   └── Dockerfile.prod (optionnel si prod prévue maintenant)
├── frontend/                # React/Vite
│   ├── src/
│   ├── package.json
│   ├── vite.config.js
│   ├── Dockerfile.dev
│   └── Dockerfile.prod (optionnel si prod prévue maintenant)
├── docker-compose.dev.yml
├── docker-compose.prod.yml (squelette ok, prod complète optionnelle)
├── .env.dev
├── .env.prod
├── .env.local.example
├── .gitignore
└── docs/
    ├── README_DEV.md
    └── SECURITY.md (crypto, secrets, menaces, limites)

---

## 3) Exigences fonctionnelles (MVP)
### Auth
- Auth JWT simple (comme MDP) :
  - login → token stocké dans `localStorage` (clé : `con.jwt`)
  - interceptor `401` → redirection `/login`
- Endpoints typiques :
  - `POST /api/auth/login` (email/password) -> JWT
  - `GET /api/auth/me` -> infos user (optionnel)
- En DEV : créer un compte admin/dev via variables dans `.env.local` :
  - `ADMIN_USERNAME`
  - `ADMIN_EMAIL`
  - `ADMIN_PASSWORD`
Le backend doit fournir une commande/script `seed` ou init automatique au boot (idempotent).

### Contacts publics (en clair)
CRUD complet :
- `GET /api/public-contacts`
- `POST /api/public-contacts`
- `GET /api/public-contacts/:id`
- `PUT /api/public-contacts/:id`
- `DELETE /api/public-contacts/:id`

Champs recommandés (MVP) :
- id (uuid)
- title (nom du contact)
- organization
- phone
- email
- address
- website
- notes
- tags (array)
- timestamps

### Contacts privés (E2EE)
CRUD complet MAIS le backend ne manipule que du “blob” chiffré :
- `GET /api/private-contacts` -> renvoie metadata minimale + ciphertext
- `POST /api/private-contacts` -> stocke ciphertext/iv/salt/version
- `GET /api/private-contacts/:id`
- `PUT /api/private-contacts/:id`
- `DELETE /api/private-contacts/:id`

Schéma minimal (recommandé) :
- id (uuid)
- ciphertext (bytea/base64)
- iv (bytea/base64)
- salt (bytea/base64) (si utilisé)
- crypto_version (int)
- created_at / updated_at

**IMPORTANT** : le contenu privé (nom, téléphone, notes, etc.) est chiffré côté frontend uniquement.

---

## 4) Crypto — exigences techniques
Utiliser WebCrypto (natif navigateur) :
- AES-GCM pour chiffrer/déchiffrer
- IV aléatoire par enregistrement
- dérivation de clé depuis un secret utilisateur :
  - option A (simple) : PBKDF2 (WebCrypto natif)
  - option B (mieux) : Argon2id (si lib JS ajoutée; optionnel en MVP)
- Stockage : le backend et la DB ne voient que ciphertext/iv(/salt)

Créer dans le frontend :
- `src/utils/cryptoContacts.js` (ou équivalent)
- fonctions :
  - `deriveKey(...)`
  - `encryptPrivateContact(plaintextObj) -> {ciphertext, iv, salt, crypto_version}`
  - `decryptPrivateContact(payload) -> plaintextObj`

Créer un petit test manuel documenté dans `docs/SECURITY.md`.

---

## 5) UI/UX — “même visuel que GestionnaireMDP”
But : reproduire le layout/pattern du MDP :
- page Login
- page principale Contacts :
  - colonne gauche : liste, filtre/recherche, tags
  - panneau droit : détail + édition
- CSS global unique : `frontend/src/styles.css`
- composants simples (ex. `ToastProvider` si désiré), mais rester minimal MVP.

Vite :
- `VITE_API_BASE=/api`
- proxy `/api` -> `http://backend:8000` (dans `vite.config.js`)

---

## 6) Base de données & migrations
Postgres dans docker compose.
Utiliser une stratégie simple :
- option A (simple MVP) : SQL init dans `backend/sql/init.sql` + exécution au boot
- option B : knex/prisma migrations (acceptable si rapidement opérationnel)

Le but : un `docker compose up` doit suffire.

---

## 7) Livrables obligatoires (DoD)
À la fin, le projet doit permettre :

### Démarrage DEV
Commande unique :
- `docker compose -f docker-compose.dev.yml --env-file .env.dev up -d --build`

URLs attendues :
- Frontend : `http://localhost:5177`
- API health : `http://localhost:8005/api/health`

### Santé / diagnostics
- endpoint `GET /api/health` -> `{status:"ok"}` + version
- logs clairs
- docs `README_DEV.md` avec étapes exactes

### Fichiers d’environnement
- `.env.dev` (commitable)
- `.env.local.example` (commitable)
- `.env.local` (à créer localement par l’utilisateur, NON commité)
- `.gitignore` correct

### Sécurité
- aucune clé/secrets en dur dans le repo
- expliquer brièvement le modèle E2EE dans `docs/SECURITY.md`

---

## 8) Plan d’exécution recommandé (ordre)
1) Générer structure repo + compose + env + gitignore
2) Mettre DB up + tables (public/private + users)
3) Implémenter API Node + auth JWT + health
4) Implémenter frontend Vite + pages Login/Contacts + style global
5) Implémenter crypto E2EE côté frontend + endpoints private
6) Écrire docs (README_DEV + SECURITY)
7) Vérifier flow complet : login -> CRUD public -> CRUD privé

---

## 9) Contraintes importantes
- Ne pas casser les invariants (ports, noms, env, compose).
- Ne pas mettre de secrets dans `.env.dev` / `.env.prod`.
- Toujours privilégier un MVP fonctionnel “end-to-end”.
- Minimiser les dépendances; si Prisma/knex est utilisé, documenter clairement.
- Écrire des commandes et chemins exacts dans la doc.

---

## 10) Notes pour l’agent
Si une décision est ambiguë :
- choisir l’option la plus simple qui respecte le MVP
- documenter la décision dans `docs/README_DEV.md` ou `docs/SECURITY.md`

Fin.
