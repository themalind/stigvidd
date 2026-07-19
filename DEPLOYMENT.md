# Deploying & Migrating Stigvidd

How to stand up the full Stigvidd stack on a new host and move data between
hosts. The whole environment is defined by [docker-compose.yml](docker-compose.yml)
and is designed to be picked up and moved at will.

- [The stack](#the-stack)
- [Prerequisites](#prerequisites)
- [Part 1 — Deploy to a new host](#part-1--deploy-to-a-new-host)
- [Part 2 — Configuration reference](#part-2--configuration-reference-env)
- [Part 3 — CI/CD (Jenkins)](#part-3--cicd-jenkins)
- [Part 4 — Migrating data](#part-4--migrating-data)
- [Part 5 — Cutover checklist](#part-5--cutover-checklist)
- [Troubleshooting](#troubleshooting)

---

## The stack

Six services on two networks. Only the proxy is exposed to the internet.

| Service    | Image                     | Role                                            |
|------------|---------------------------|-------------------------------------------------|
| `proxy`    | `stigvidd-proxy` (Caddy)  | TLS termination + Let's Encrypt, routes subdomains. **Only** service on 80/443. |
| `web`      | `stigvidd-web` (nginx)    | React admin SPA.                                 |
| `api`      | `stigvidd-api` (.NET 10)  | Backend API. Runs EF migrations on startup.     |
| `media`    | `stigvidd-media` (nginx)  | WebDAV media server (authed writes, public reads). |
| `keycloak` | `stigvidd-keycloak`       | Identity provider.                              |
| `db`       | `postgis/postgis:16-3.4`  | PostgreSQL + PostGIS. Holds **both** the app database and Keycloak's. |

**What is stateful** (i.e. what must be migrated):

- **`pgdata` volume** — the app database *and* the `keycloak` database live here.
- **`media` volume** — uploaded images.
- **`caddy_data` volume** — issued TLS certs. *Not* migrated; Caddy re-issues on the new host.

Everything else (images, compose file, `db/` init scripts) is reproducible. The
only file you carry by hand is **`.env`** (secrets).

### Domains

Each subdomain needs a public DNS record pointing at the host:

| Domain (default)      | → service |
|-----------------------|-----------|
| `stigvidd.se`         | web       |
| `api.stigvidd.se`     | api       |
| `media.stigvidd.se`   | media     |
| `auth.stigvidd.se`    | keycloak  |

---

## Prerequisites

On the **target host**:

- Docker Engine + Docker Compose v2, and the user in the `docker` group.
- Network access to the private registry `inkaben.se`.
- **DNS**: all four subdomains resolve to this host's public IP, with **ports 80
  and 443 reachable** (required for Let's Encrypt to issue certificates).

---

## Part 1 — Deploy to a new host

### 1. Get the deploy files onto the host

You need `docker-compose.yml`, the `db/` directory, and a `.env`. Create a
working directory (the compose "project" dir), e.g. `/opt/stigvidd`:

```bash
mkdir -p /opt/stigvidd && cd /opt/stigvidd
# copy docker-compose.yml and db/ here (git checkout, scp, or Jenkins deploy)
cp /path/to/repo/docker-compose.yml .
cp -r /path/to/repo/db .
cp /path/to/repo/.env.example .env
```

### 2. Fill in `.env`

Edit `.env` — see the [configuration reference](#part-2--configuration-reference-env).
At minimum set the domains, `ACME_EMAIL`, and all passwords.

> **Tip:** while testing DNS, set `ACME_CA` to the Let's Encrypt **staging**
> endpoint to avoid rate limits (certs will be untrusted — that's expected).

### 3. Log in to the registry and start

```bash
docker login inkaben.se          # username: stigvidd
docker compose pull
docker compose up -d
```

On first start:

- `db` creates the app database and the `keycloak` database (`db/init/`).
- `api` runs its EF migrations (creates the PostGIS schema).
- `keycloak` migrates its schema.
- `proxy` obtains Let's Encrypt certificates for all four domains (seconds, once DNS is right).

### 4. Verify

```bash
docker compose ps                 # all services Up / healthy
curl -I https://stigvidd.se       # web
curl -I https://api.stigvidd.se   # api
curl -I https://auth.stigvidd.se  # keycloak
```

### 5. Keycloak realm (first deploy only)

A fresh Keycloak is empty. The app expects realm `stigvidd` with clients
`stigvidd-api`, `stigvidd-admin-api`, `stigvidd-admin`. Either:

- **Import an existing realm export** (keeps client secrets matching
  [appsettings.json](backend/StigviddAPI/appsettings.json)) — recommended, or
- Recreate the realm/clients by hand in the admin console at
  `https://auth.stigvidd.se/admin` (log in with `KC_ADMIN_USER` /
  `KC_ADMIN_PASSWORD`).

Grant your admin user the **`admin` realm role** — the web Migration page and
its API endpoints require it.

> If you migrate data from another host (Part 4), the realm comes across with it
> and you can skip this step.

---

## Part 2 — Configuration reference (`.env`)

Copy [.env.example](.env.example) to `.env` and set:

| Variable | What |
|----------|------|
| `REGISTRY` / `IMAGE_TAG` | Image source. `inkaben.se` and the tag to run (CI sets these; default `latest`). |
| `WEB_DOMAIN` / `API_DOMAIN` / `MEDIA_DOMAIN` / `AUTH_DOMAIN` | The four public hostnames. |
| `ACME_EMAIL` | Let's Encrypt contact address. |
| `ACME_CA` | Leave at production; switch to LE staging while testing. |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | Database. Keep identical to the source when restoring a backup. |
| `KEYCLOAK_URL` | Public issuer URL, e.g. `https://auth.stigvidd.se`. |
| `KEYCLOAK_DB` | Keycloak's database name (default `keycloak`). |
| `KC_ADMIN_USER` / `KC_ADMIN_PASSWORD` | First-boot Keycloak admin. Rotate after first login. |
| `WEBDAV_USER` / `WEBDAV_PASSWORD` | Credentials the API uses to write media. |
| `PRESENTABLE_BASE_URL` | Public media base URL, e.g. `https://media.stigvidd.se/` (trailing slash). |
| `VITE_API_URL` / `VITE_OIDC_URL` / `VITE_OIDC_REALM` / `VITE_CLIENT_ID` | Baked into the web bundle at **build** time. |

> **`VITE_*` are build-time.** They are compiled into the web image by CI. With
> stable public domains you rarely change them, but if you do, the web image must
> be **rebuilt** (not just restarted).

Keep `.env` secret and out of git (it already is).

---

## Part 3 — CI/CD (Jenkins)

The pipeline ([Jenkinsfile](Jenkinsfile)) tests, builds & pushes all custom
images (`api web media proxy keycloak`) to `inkaben.se`, then deploys over SSH:
`docker compose pull && up -d` on the target. See the header of the Jenkinsfile
for the full setup (credentials, plugins, deploy-host prep).

For a **manual** deploy of a specific build, set `IMAGE_TAG` in the host `.env`
(or inline) and run `docker compose pull && docker compose up -d`.

---

## Part 4 — Migrating data

Three tools, for three situations. All of them move the same stateful data
(database + media + Keycloak); pick by how you want to do it.

### Method A — Admin web (no shell access) — recommended for content clones

Best when you want to clone content from one running host to another through the
browser, without SSH.

1. On the **source**, sign in to the admin web → **Migration** →
   **Export all data**. Downloads a single archive (app DB + Keycloak DB +
   referenced media).
2. On the **target** (already deployed per Part 1), go to **Migration** →
   **Import**, choose the archive, type the hostname to confirm, and import.
3. **Restart** the target's api + keycloak (the import replaces the databases
   they were connected to):
   ```bash
   docker compose restart api keycloak
   ```

> Import is **destructive** — it replaces all data on the target. Run it on a
> freshly deployed, idle target (before it serves traffic). Requires the `admin`
> realm role.

### Method B — Volume copy (shell) — exact byte-for-byte clone

Best for a full host move where you have SSH on both ends. Copies the raw
`pgdata` (app **and** Keycloak databases) and `media` volumes.

On the **source** (in the compose dir):

```bash
./scripts/migrate.sh backup stigvidd-data.tar.gz     # stops the stack, snapshots volumes
scp stigvidd-data.tar.gz .env docker-compose.yml  target:/opt/stigvidd/
scp -r db                                          target:/opt/stigvidd/
docker compose up -d                                 # bring source back up (or leave down for cutover)
```

On the **target** (in `/opt/stigvidd`):

```bash
docker login inkaben.se
./scripts/migrate.sh restore stigvidd-data.tar.gz    # creates + fills the volumes
docker compose pull && docker compose up -d
```

See [scripts/migrate.sh](scripts/migrate.sh). It refuses to overwrite a
non-empty volume, and stops the stack during backup for a consistent snapshot.

### Method C — Import media from a legacy external WebDAV (one-time)

Only needed the first time you move off the *old* external WebDAV server (the
new `media` volume starts empty). Pulls existing images into it.

```bash
# on the new host, after the stack has created the media volume once
SRC_URL=https://old-webdav-host/dav/ SRC_USER=<u> SRC_PASS=<p> \
  ./scripts/import-media.sh
```

See [scripts/import-media.sh](scripts/import-media.sh) (`--dry-run` to preview,
`--vendor` if the source is Nextcloud/ownCloud, etc.). After this, Method B
carries the `media` volume on subsequent moves.

### Which method?

| Situation | Method |
|-----------|--------|
| Clone content between running hosts, no shell | **A** (admin web) |
| Full host move, SSH available, exact copy incl. orphaned media | **B** (`migrate.sh`) |
| First move off the old external WebDAV | **C** (`import-media.sh`), once |

Both A and B carry Keycloak (realms, users, credentials) because Keycloak's data
lives in the same Postgres.

---

## Part 5 — Cutover checklist

For a near-zero-loss move to a new host:

1. **Provision** the target and deploy the stack (Part 1), pointing DNS at it is
   *not* done yet — use LE staging or the host IP to verify it boots.
2. **Freeze writes** on the source (put it in maintenance / stop `web` + `api`,
   leave `db` up).
3. **Migrate data** (Method B for a full copy, or A).
4. On the target: restore, `docker compose up -d`, and if you used Method A,
   `docker compose restart api keycloak`.
5. **Verify** on the target (see below).
6. **Switch DNS** — point all four subdomains at the new host. Caddy issues fresh
   certs automatically within seconds (production `ACME_CA`).
7. Decommission the old host once the new one is confirmed healthy.

### Post-migration verification

```bash
docker compose ps                                   # all Up
docker compose exec db psql -U stigvidd -d stigvidd -c "SELECT count(*) FROM trails;"
docker compose exec db psql -U stigvidd -d keycloak -tAc "SELECT count(*) FROM user_entity;"
curl -I https://media.stigvidd.se/<some/known/image/path>   # 200
# sign in to the web admin and confirm content + that login (Keycloak) works
```

---

## Troubleshooting

**Certificates won't issue / HTTPS fails.**
DNS for the domain must resolve to this host and ports 80/443 must be reachable
*before* Caddy can validate. Check `docker compose logs proxy`. Use LE staging
(`ACME_CA`) while iterating to avoid rate limits.

**`api` can't validate tokens / 401 everywhere.**
The token issuer must match `KEYCLOAK_URL` (the public URL). Confirm Keycloak is
reachable at `https://auth.stigvidd.se` and the realm/clients exist. The proxy's
internal network aliases let the API reach `auth.stigvidd.se` with a valid cert.

**Keycloak won't start after an import.**
Restart it: `docker compose restart keycloak`. Keycloak caches realm state and
must reconnect after its database is replaced.

**Migrating onto an existing `pgdata` that predates Keycloak.**
The `keycloak` database is only auto-created on a *fresh* volume. Create it once:
```bash
docker compose exec db createdb -U stigvidd keycloak
```

**Media returns 200 but images 404 after a move.**
Media is referenced by path in the DB. Method A exports only *referenced* files;
if you expect orphaned files too, use Method B (whole `media` volume).

**Import (admin web) fails or conflicts.**
Run it on an idle target — `pg_restore --clean` needs to drop/recreate objects
and active queries can hold locks. Restart api + keycloak afterwards.
