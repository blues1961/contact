# README_DEV

## Objectif
Monorepo MVP `con` pour gerer des contacts publics et des contacts prives chiffres cote frontend.

## Fichiers d'environnement
1. Copier `.env.local.example` vers `.env.local`.
2. Renseigner uniquement dans `.env.local` :
   - `POSTGRES_PASSWORD`
   - `JWT_SECRET`
   - `ADMIN_USERNAME`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
3. Ne jamais committer `.env.local`.

## Demarrage DEV
Commande unique :

```bash
docker compose -f docker-compose.dev.yml --env-file .env.dev up -d --build
```

Diagnostics utiles :

```bash
docker compose -f docker-compose.dev.yml --env-file .env.dev ps
docker compose -f docker-compose.dev.yml --env-file .env.dev logs -f db
docker compose -f docker-compose.dev.yml --env-file .env.dev logs -f backend
docker compose -f docker-compose.dev.yml --env-file .env.dev logs -f frontend
```

URLs attendues :
- Frontend : `http://localhost:5177`
- API health : `http://localhost:8005/api/health`

## Choix techniques
- Base Postgres pilotee par Docker Compose.
- Initialisation simple via `backend/sql/init.sql`, executee par le backend au boot.
- Seed admin/dev idempotent au demarrage du backend.
- Auth JWT simple, stockee dans `localStorage` sous `con.jwt`.
- Donnees privees chiffrees dans le navigateur avant envoi.

## Flow MVP
1. Ouvrir `http://localhost:5177`.
2. Se connecter avec `ADMIN_EMAIL` ou `ADMIN_USERNAME` et `ADMIN_PASSWORD`.
3. Creer/modifier/supprimer des contacts publics.
4. Choisir l'onglet `Prive`.
5. Saisir un secret de coffre local, deverrouiller, puis creer/modifier/supprimer des contacts prives.

## Notes
- Le backend ecoute dans le conteneur sur `8000`, expose sur l'hote via `8005`.
- Vite ecoute sur `5177` et proxy `/api` vers `http://backend:8000`.
- Les contacts prives ne sont pas recherchables cote serveur, car le backend ne detient pas les donnees en clair.

