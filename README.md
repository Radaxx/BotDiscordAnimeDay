# Anime du Jour 🌸

Bot Discord qui poste chaque jour un anime dans un salon. Chaque post contient :

- une fiche complète tirée d'AniList : bannière, titre (et titre japonais), synopsis, date de diffusion, studio, format, note, source, statut et genres. La couleur de la bordure reprend la couleur dominante de l'affiche ;
- quatre boutons de vote avec compteurs : **❤️ Vu, aimé**, **👎 Vu, pas aimé**, **🔖 Ça me tente**, **🚫 Pas pour moi** ;
- un fil de discussion créé automatiquement, ouvert par une question et un rappel anti-spoil.

Chaque membre a un seul vote par anime. Il peut le changer à tout moment, ou l'annuler depuis la confirmation qui n'est visible que par lui. Chaque dimanche, le bot poste un récap de la semaine : % de « aimé » parmi ceux qui l'ont vu, anime le plus attendu, anime le plus discuté.

## Commandes

| Commande | Qui | Effet |
| --- | --- | --- |
| `/watchlist` | tout le monde | Liste privée des animes marqués 🔖 « Ça me tente » |
| `/anime poster [anilist_id]` | permission « Gérer le serveur » | Poste un anime tout de suite (au hasard, ou celui de l'id AniList donné) |
| `/anime recap` | permission « Gérer le serveur » | Poste le récap des 7 derniers jours tout de suite |

## Installation

Prérequis : Node.js 22.13 ou plus récent (la base SQLite intégrée à Node est utilisée, aucune compilation native).

1. Sur le [Discord Developer Portal](https://discord.com/developers/applications), créez une application puis un bot, et copiez le token.
2. Invitez le bot sur votre serveur avec les scopes `bot` et `applications.commands`, et les permissions : Voir les salons, Envoyer des messages, Intégrer des liens, Créer des fils publics, Envoyer des messages dans les fils.
3. Configurez et lancez :

```bash
npm install
```

```bash
cp .env.example .env
```

Remplissez `.env` (token, id de l'application, id du serveur, id du salon), puis :

```bash
npm start
```

Les commandes slash sont enregistrées au démarrage. Pour tester sans attendre 10h, utilisez `/anime poster`.

## Configuration

Tout se règle dans `.env` (voir `.env.example`) : heure du post (`DAILY_CRON`), heure du récap (`RECAP_CRON`), fuseau horaire, et critères de tirage (`MIN_SCORE`, `POOL_SIZE`). Un anime déjà posté n'est jamais retiré au sort une seconde fois.

## Structure

- `src/index.js` : connexion Discord, enregistrement des commandes, planification
- `src/bot.js` : post quotidien, récap, gestion des votes et des commandes
- `src/messages.js` : construction des embeds, boutons et textes (design A)
- `src/anilist.js` : requêtes à l'API GraphQL d'AniList
- `src/db.js` : stockage SQLite des posts et des votes
- `src/i18n.js` : traductions françaises des genres, saisons, formats…

## Tests

```bash
npm test
```

## Limites connues

- AniList ne fournit les synopsis qu'en anglais. Le reste de la fiche est traduit.
