# CODEX_START.md — Démarrage Codex Agent (Contact / con)

## Objectif
Lancer Codex CLI en mode agent local pour construire le MVP complet décrit dans les instructions du repo.

## Pré-requis (repo)
- Le repo est un git repo (git init OK).
- Les instructions projet sont dans `AGENTS.md` à la racine (voir ci-dessous).
- `AGENTS.md` est la source d’autorité (invariants, ports, secrets, structure, DoD).

## IMPORTANT — Instructions Codex
Codex charge automatiquement `AGENTS.md`. Si tu as un fichier nommé `AGENT.md`, renomme-le en `AGENTS.md`
ou crée `AGENTS.md` qui pointe vers `AGENT.md`, mais l’agent doit lire `AGENTS.md` en premier.

## Règles d’exécution (autonomie maximale, mais contrôlée)
1) Lis `AGENTS.md` et respecte strictement les invariants (APP_SLUG=con, APP_NO=4, ports, secrets).
2) Travaille par étapes et fais des commits logiques (checkpoint git fréquent).
3) N’introduis aucun secret dans le repo. Utilise `.env.local.example` + `.gitignore`.
4) Objectif final: `docker compose -f docker-compose.dev.yml --env-file .env.dev up -d --build`
   => Frontend http://localhost:5177
   => API health http://localhost:8005/api/health

## Demande initiale (à coller dans Codex)
Lis `AGENTS.md` puis implémente le MVP end-to-end.
Avance au maximum sans demander confirmation.
Fais des commits par étape (scaffold -> db -> api -> frontend -> crypto -> docs).
À la fin, exécute le flow de démarrage DEV et documente tout dans docs/README_DEV.md et docs/SECURITY.md.
