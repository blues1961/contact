# README_PROD

## Objectif
Deployer `contact` sur un serveur Linux avec Docker Compose et un reverse proxy Traefik deja present sur le reseau Docker externe `edge`, a l'image de `gestionnaireMDP`.

## Modele retenu
- `db` : PostgreSQL persistant via volume externe `con_prod_pgdata`
- `backend` : Node/Express en mode production sur le reseau interne `appnet`
- `frontend` : build Vite servi par Nginx
- exposition HTTPS par Traefik via labels Docker et reseau `edge`

## Pre-requis serveur
- Docker Engine et Docker Compose installes
- Traefik deja deploye et connecte au reseau Docker externe `edge`
- DNS du domaine cible pointant vers le serveur

## Variables a ajuster
Dans `.env.prod` :
- `APP_HOST=contact.example.com` -> remplacer par le vrai domaine
- `PROD_DB_PORT`, `PROD_API_PORT`, `PROD_FRONT_PORT` seulement si tu veux aussi un acces local par ports binds

Dans `.env.local` :
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

## Preparation du serveur
```bash
git clone <url-du-repo> contact
cd contact
cp .env.local.example .env.local
docker volume create con_prod_pgdata
docker network create edge
```

Si Traefik existe deja, le reseau `edge` existe probablement deja. La creation retournera une erreur benigne si tu la relances par habitude.

## Demarrage prod
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f backend
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f frontend
```

Equivalent via `Makefile` avec `.env -> .env.prod` :

```bash
ln -snf .env.prod .env
make up
make ps
```

## Routage Traefik
- `https://APP_HOST/` -> frontend
- `https://APP_HOST/api/...` -> backend

Le frontend est servi par Nginx. Le backend reste sur `8000` dans son conteneur.

## Verification apres deploiement
```bash
curl -I https://APP_HOST
curl https://APP_HOST/api/health
```

## Notes
- Le chiffrement des contacts prives reste cote navigateur. Le serveur ne voit toujours que `ciphertext`, `iv`, `salt`, `crypto_version`.
- Pour utiliser WebCrypto sur telephone, il faut bien ouvrir l'application via `https://APP_HOST`.
- Le compose prod de `contact` suit le meme principe de labels Traefik et reseau `edge` que `gestionnaireMDP`.
- Le `Makefile` choisit automatiquement `docker-compose.dev.yml` ou `docker-compose.prod.yml` en fonction du symlink `.env`.
