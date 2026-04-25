# SECURITY

## Modele E2EE
- Les contacts publics sont stockes en clair dans Postgres.
- Les contacts prives sont chiffrés uniquement dans le frontend avant envoi.
- Le backend et la base ne voient que :
  - `ciphertext`
  - `iv`
  - `salt`
  - `crypto_version`

## Crypto MVP
- Algorithme : `AES-GCM` via WebCrypto.
- Derivation de cle : `PBKDF2` SHA-256, 310000 iterations.
- Sel : aleatoire par enregistrement.
- IV : aleatoire par enregistrement.
- Version de crypto : `1`.

## Limites
- Le secret de coffre prive n'est pas stocke par l'application. Si l'utilisateur le perd, les contacts prives sont irrecuperables.
- La recherche plein texte sur les contacts prives est faite uniquement apres dechiffrement local.
- Le token JWT est stocke dans `localStorage`, ce qui reste un compromis MVP.
- Le backend gere l'authentification et l'autorisation, mais pas le dechiffrement.

## Test manuel recommande
1. Demarrer l'application avec Docker Compose.
2. Se connecter avec le compte seed.
3. Creer un contact prive avec un secret de coffre.
4. Verifier via l'API `GET /api/private-contacts` que la reponse contient uniquement `ciphertext`, `iv`, `salt`, `crypto_version`, sans champs metier.
5. Changer le secret de coffre et constater que le dechiffrement echoue.
6. Revenir au bon secret et confirmer que le contact redevient lisible.

## Secrets
- Aucun secret ne doit etre commite.
- Les secrets attendus sont confines a `.env.local`.
- `.env.local.example` ne contient que des placeholders.
