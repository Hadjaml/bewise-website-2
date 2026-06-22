# Bewise site

Site responsive mobile-first avec petit backend Node natif, API JSON, formulaire d'audit et page admin.

## Lancer le site

```bash
npm start
```

Par défaut, le serveur écoute sur `http://localhost:4173`.

## Admin

Page admin: `http://localhost:4173/admin`

Identifiants par défaut:

- Utilisateur: `admin`
- Mot de passe: `bewise2026`

En production, définir ces variables d'environnement:

```bash
ADMIN_USER=votre-utilisateur ADMIN_PASSWORD=votre-mot-de-passe SESSION_SECRET=une-cle-longue npm start
```

Les demandes d'audit et le contenu éditable sont stockés dans `data/db.json`.

## Notifications email

Chaque nouvelle demande d'audit peut envoyer un email à `hadja@ml-handc.com` via Resend.

Variables à configurer en production:

```bash
RESEND_API_KEY=votre-cle-resend EMAIL_FROM="Bewise <contact@votre-domaine.fr>" npm start
```

Optionnel: changer le destinataire avec `LEAD_NOTIFY_EMAIL`.
