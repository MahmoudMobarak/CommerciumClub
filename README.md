# Commercium — Club Website

The Commerce Club at The Westminster School, Dubai. A fully self-contained, interactive
website with an admin panel for managing content — no external services, no build step,
zero dependencies.

## Run it

Requires [Node.js](https://nodejs.org) 16+.

```bash
node server.js
# or: npm start
```

Then open **http://localhost:4173**

A custom port works too: `PORT=8080 node server.js`

## Admin panel

Open **http://localhost:4173/admin.html** and sign in.

**Default credentials (first run):**

| field    | value            |
|----------|------------------|
| username | `admin`          |
| password | `commercium2026` |

> Also saved in **`ADMIN-CREDENTIALS.txt`** at the project root.

> **Change the password from the admin Settings tab right away.** Credentials are stored
> hashed (scrypt) in `data/credentials.json`.

## What the admin can manage

Everything below updates the public site instantly (stored in `data/db.json`, uploads in
`data/uploads/`):

- **Gallery** — add photos (drag in from your device), reorder, caption, delete
- **Events** — add/edit/delete upcoming events (public pages show live countdowns)
- **Achievements** — the trophy case on the Achievements page
- **Posts** — community feed on the Commerunity page
- **Announcements** — the Notifications page
- **Articles** — the Commercipedia blog
- **Site text** — hero title/subtitle and About section wording
- **Credentials** — change the admin username and password

## Pages

| Page               | URL                  |
|--------------------|----------------------|
| Home               | `/`                  |
| Activities         | `activities.html`    |
| Achievements       | `achievements.html`  |
| Commerunity        | `commerunity.html`   |
| Commercipedia      | `commercipedia.html` |
| Notifications      | `notifications.html` |
| Membership Form    | `membership.html`    |
| Admin              | `admin.html`         |

## Architecture

- **`server.js`** — zero-dependency Node HTTP server: static files, session auth
  (scrypt-hashed password, HttpOnly cookie sessions), JSON content API, base64 photo uploads.
- **`data/db.json`** — all editable content (seeded with the club's existing content).
- **`data/uploads/`** — photos added from the admin panel.
- **`assets/`** — CSS design system, shared UI, admin app, and the photo library
  (cleanly renamed copies of the original site's images).
- **Public pages** fetch `/api/data` and render — the admin edits the same data.
  Each page also embeds a snapshot of the content (`assets/js/data.js`), so pages still
  render with photos, events, and text even if you just double-click `index.html` from
  disk with no server running. The server regenerates that snapshot whenever the admin
  saves changes.

## Security notes

- Sessions expire after 12 hours; the cookie is HttpOnly and SameSite.
- Passwords are never stored in plain text.
- The server is designed for local/school use. For public hosting, put it behind a
  reverse proxy with HTTPS (e.g. Caddy, nginx, or a platform like Render/Railway).
