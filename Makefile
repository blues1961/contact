SHELL := /bin/bash
.ONESHELL:
.DEFAULT_GOAL := help

ENV_LINK_TARGET := $(shell if [ -L .env ]; then readlink .env; fi)
APP_ENV := $(patsubst .env.%,%,$(notdir $(ENV_LINK_TARGET)))
ENV_FILE := .env.$(APP_ENV)
COMPOSE_FILE := docker-compose.$(APP_ENV).yml
COMPOSE := docker compose --env-file $(ENV_FILE) -f $(COMPOSE_FILE)

.PHONY: help env env-check env-check-base env-check-local set-dev set-prod \
	up down stop start restart rebuild build ps logs logs-db logs-backend logs-frontend \
	exec-db exec-backend exec-frontend config

help: ## Liste les commandes disponibles
	@echo -e "Usage: make <target>\n"
	@grep -E '^[a-zA-Z0-9_-]+:.*## ' $(MAKEFILE_LIST) \
	 | sed -E 's/^([a-zA-Z0-9_-]+):.*## (.*)$$/\1\t\2/' \
	 | sort -f \
	 | awk -F'\t' '{printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

env: env-check-base ## Affiche l'environnement courant detecte via .env
	@echo "APP_ENV=$(APP_ENV)"
	@echo "ENV_FILE=$(ENV_FILE)"
	@echo "COMPOSE_FILE=$(COMPOSE_FILE)"

env-check-base: ## Verifie que .env pointe vers .env.dev ou .env.prod
	test -L .env || { echo "Symlink .env manquant (ex: ln -snf .env.dev .env)"; exit 1; }
	test -n "$(APP_ENV)" || { echo ".env doit pointer vers .env.dev ou .env.prod"; exit 1; }
	test -f $(ENV_FILE) || { echo "$(ENV_FILE) introuvable"; exit 1; }
	test -f $(COMPOSE_FILE) || { echo "$(COMPOSE_FILE) introuvable"; exit 1; }

env-check-local: ## Verifie la presence des secrets locaux (.env.local)
	test -f .env.local || { echo ".env.local introuvable (ex: cp .env.local.example .env.local)"; exit 1; }

env-check: env-check-base env-check-local ## Verifie env + secrets locaux

set-dev: ## Pointe .env vers .env.dev
	ln -snf .env.dev .env
	@echo ".env -> .env.dev"

set-prod: ## Pointe .env vers .env.prod
	ln -snf .env.prod .env
	@echo ".env -> .env.prod"

up: env-check ## Demarre les conteneurs de l'environnement courant
	$(COMPOSE) up -d --build

down: env-check ## Arrete et supprime les conteneurs de l'environnement courant
	$(COMPOSE) down

stop: env-check ## Stoppe les conteneurs sans les supprimer
	$(COMPOSE) stop

start: env-check ## Redemarre les conteneurs existants
	$(COMPOSE) start

restart: env-check ## Redemarre les conteneurs
	$(COMPOSE) restart

build: env-check ## Build les images de l'environnement courant
	$(COMPOSE) build

rebuild: env-check ## Rebuild les images sans cache puis relance l'environnement
	$(COMPOSE) build --no-cache
	$(COMPOSE) up -d --build

ps: env-check ## Affiche l'etat des conteneurs
	$(COMPOSE) ps

logs: env-check ## Suit les logs de tous les services
	$(COMPOSE) logs -f --tail=200

logs-db: env-check ## Suit les logs du service db
	$(COMPOSE) logs -f --tail=200 db

logs-backend: env-check ## Suit les logs du service backend
	$(COMPOSE) logs -f --tail=200 backend

logs-frontend: env-check ## Suit les logs du service frontend
	$(COMPOSE) logs -f --tail=200 frontend

exec-db: env-check ## Ouvre un shell dans le conteneur db
	$(COMPOSE) exec db sh

exec-backend: env-check ## Ouvre un shell dans le conteneur backend
	$(COMPOSE) exec backend sh

exec-frontend: env-check ## Ouvre un shell dans le conteneur frontend
	$(COMPOSE) exec frontend sh

config: env-check ## Affiche la configuration Docker Compose resolue
	$(COMPOSE) config

