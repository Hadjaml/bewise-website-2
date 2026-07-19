# Bewise

Site vitrine Bewise pour `gobewise.com`, avec backend Node natif, tracking léger, popup Calendly, formulaire de contact et page admin.

## Lancer le site

```bash
npm start
```

Par défaut, le serveur écoute sur `http://localhost:4173`.

Pour utiliser le même port que la prévisualisation locale :

```bash
PORT=4174 npm start
```

## Vérifier avant déploiement

```bash
npm run check
```

## Admin

Page admin : `http://localhost:4173/admin`

Identifiants par défaut :

- Utilisateur : `admin`
- Mot de passe : `bewise2026`

En production, définir ces variables d'environnement :

```bash
ADMIN_USER=votre-utilisateur ADMIN_PASSWORD=votre-mot-de-passe SESSION_SECRET=une-cle-longue npm start
```

Les messages, analytics et données admin sont stockés dans `data/db.json`. La zone `Maintenance` de l'admin permet de réinitialiser les données avec le mot de passe administrateur.

## Notifications email

Chaque nouveau message de contact peut envoyer un email à `contact@gobewise.com` via Resend.

Variables à configurer en production :

```bash
RESEND_API_KEY=votre-cle-resend EMAIL_FROM="Bewise <contact@gobewise.com>" npm start
```

Optionnel : changer le destinataire avec `LEAD_NOTIFY_EMAIL`.

## Structure

- `public/index.html` : site public validé.
- `public/admin.html` : interface admin.
- `public/app.js` : navigation, tracking, modales et animations du site public.
- `public/admin.js` : rendu du dashboard admin.
- `public/styles.css` : direction artistique du site et de l'admin.
- `server.js` : serveur statique, API JSON, sessions admin, compression et cache.
