# Deploying & Migrating Stigvidd

How to stand up the full Stigvidd stack on a new host and move data between
hosts. The whole environment is defined by [docker-compose.yml](docker-compose.yml)
and is designed to be picked up and moved at will.

- [The stack](#the-stack)
- [Prerequisites](#prerequisites) · [Mail DNS records](#mail-dns-records)
- [Part 1 — Deploy to a new host](#part-1--deploy-to-a-new-host)
- [Part 2 — Configuration reference](#part-2--configuration-reference-env)
- [Part 3 — CI/CD (Jenkins)](#part-3--cicd-jenkins)
- [Part 4 — Migrating data](#part-4--migrating-data)
- [Part 5 — Cutover checklist](#part-5--cutover-checklist)
- [Troubleshooting](#troubleshooting)

---

## The stack

Seven services on two networks. Only the proxy and the mail server are exposed
to the internet.

| Service      | Image                     | Role                                            |
|--------------|---------------------------|-------------------------------------------------|
| `proxy`      | `stigvidd-proxy` (Caddy)  | TLS termination + Let's Encrypt, routes subdomains. Only service on 80/443. |
| `web`        | `stigvidd-web` (nginx)    | React admin SPA.                                 |
| `api`        | `stigvidd-api` (.NET 10)  | Backend API. Runs EF migrations on startup.     |
| `media`      | `stigvidd-media` (nginx)  | WebDAV media server (authed writes, public reads). |
| `keycloak`   | `stigvidd-keycloak`       | Identity provider. Sends the password-reset emails. |
| `mailserver` | `docker-mailserver` 15.1.0 | Mail for the domain: inbound on 25, submission on 465/587, IMAPS on 993. Upstream image — **not** built by CI. |
| `db`         | `postgis/postgis:17-3.5`  | PostgreSQL + PostGIS. Holds **both** the app database and Keycloak's. |

**What is stateful** (i.e. what must be migrated):

- **`pgdata` volume** — the app database *and* the `keycloak` database live here.
  Keycloak's SMTP settings are realm config, so they live here too.
- **`media` volume** — uploaded images.
- **`maildata` volume** — mailboxes.
- **`mailstate` volume** — Rspamd/Redis/fail2ban state (spam training, etc.).
- **`caddy_data` volume** — issued TLS certs. *Not* migrated; Caddy re-issues on the new host.
- **`maillogs` volume** — not migrated.

Everything else (images, compose file, `db/` init scripts) is reproducible. The
files you carry by hand are **`.env`** and **`mail-config/`** (mail accounts,
aliases and the DKIM private key) — both git-ignored, both secret.

### Domains

Each subdomain needs a public DNS record pointing at the host:

| Domain (default)      | → service  |
|-----------------------|------------|
| `stigvidd.se`         | web        |
| `api.stigvidd.se`     | api        |
| `media.stigvidd.se`   | media      |
| `auth.stigvidd.se`    | keycloak   |
| `mail.stigvidd.se`    | mailserver |

Mail additionally needs MX, SPF, DKIM, DMARC and a Hostup authorisation record —
see [Mail DNS records](#mail-dns-records).

---

## Prerequisites

On the **target host**:

- Docker Engine + Docker Compose v2, and the user in the `docker` group.
- Network access to the private registry `inkaben.se`, and to `ghcr.io` (the
  mail server image).
- **DNS**: all five subdomains resolve to this host's public IP, with **ports 80
  and 443 reachable** (required for Let's Encrypt to issue certificates).
- **Mail ports**: inbound **25, 465, 587, 993** reachable, and outbound **587**
  to `relay.hostup.se` permitted. Hostup blocks outbound 25 by default — that is
  expected and is exactly why mail relays through their smarthost. Confirm
  inbound 25 is *not* also filtered before relying on receiving mail:

  ```bash
  nc -zv mail.stigvidd.se 25     # from a machine OUTSIDE the VPS
  ```

- **Memory**: docker-mailserver's own recommendation is **2 GB RAM with swap
  enabled** (512 MB is its hard floor). Measured idle footprint of this
  configuration is ~160 MB PSS. Do not panic at `docker stats` showing ~1 GB for
  this container — Rspamd runs five workers sharing large mmap'd map files, and
  both `docker stats` and a naive RSS sum double-count them.
  [Troubleshooting → Mail](#mail) documents a lighter, non-Rspamd configuration.

### Mail DNS records

All of these must exist before the mail server is useful. The DKIM record is
generated on first boot (Part 1, step 6) — the rest can be set up front.

| Type | Name                          | Value                                                 | Why |
|------|-------------------------------|-------------------------------------------------------|-----|
| A    | `mail.stigvidd.se`            | this host's public IP                                 | Caddy's certificate + the MX target. |
| MX   | `stigvidd.se`                 | `10 mail.stigvidd.se.`                                | Receive mail for the domain. |
| TXT  | `stigvidd.se`                 | `v=spf1 a mx include:spf.hostup.se ~all`               | Authorises Hostup's relay to send as this domain. |
| TXT  | `_hostup.stigvidd.se`         | `v=mc1 auth=<this host's public IP>`                  | Hostup's own IP allowlist. **Without it the relay refuses the mail.** |
| TXT  | `_dmarc.stigvidd.se`          | `v=DMARC1; p=none; rua=mailto:postmaster@stigvidd.se` | Start permissive; tighten to `p=quarantine` once reports look clean. |
| TXT  | `mail._domainkey.stigvidd.se` | *(generated on first boot — Part 1 step 6)*           | DKIM signature verification. |
| PTR  | this host's public IP         | `mail.stigvidd.se`                                    | Ask Hostup support to set rDNS. Affects inbound reputation. |

> **One SPF record only.** If `stigvidd.se` already has an SPF TXT record, merge
> `include:spf.hostup.se` into the existing one. Two SPF records is a hard fail,
> not a merge.

See [Hostup's smarthost documentation](https://hostup.se/support/smarthost/) for
the authoritative relay details.

---

## Part 1 — Deploy to a new host

> ### Upgrading an existing host — do this first
>
> The mail server introduces required variables. `MAIL_DOMAIN` is guarded with
> `${MAIL_DOMAIN:?…}` on the `api`, `proxy` and `mailserver` services, and
> compose interpolates the **whole file** before doing anything — so until it is
> present in `/opt/stigvidd/.env`, *every* compose command on that host fails,
> including the CI deploy's `pull`/`up` for unrelated services.
>
> Before merging this to `main`, on the deploy host:
>
> ```bash
> cd /opt/stigvidd
> mkdir -p mail-config
> cat >> .env <<'EOF'
> MAIL_DOMAIN=mail.stigvidd.se
> MAIL_RELAY_HOST=relay.hostup.se
> MAIL_RELAY_PORT=587
> POSTMASTER_ADDRESS=postmaster@stigvidd.se
> TZ=Europe/Stockholm
> SMTP_NOREPLY_USER=no-reply@stigvidd.se
> SMTP_NOREPLY_PASSWORD=<pick a strong secret>
> EOF
> ```
>
> Then follow steps 6 and 7 below to create the mailboxes and point Keycloak at
> them. Steps 1–5 are for a genuinely new host.

### 1. Get the deploy files onto the host

You need `docker-compose.yml`, the `db/` directory, and a `.env`. Create a
working directory (the compose "project" dir), e.g. `/opt/stigvidd`:

```bash
mkdir -p /opt/stigvidd && cd /opt/stigvidd
# copy docker-compose.yml and db/ here (git checkout, scp, or Jenkins deploy)
cp /path/to/repo/docker-compose.yml .
cp -r /path/to/repo/db .
cp /path/to/repo/.env.example .env
# The mail server's config dir. Empty is fine — it is filled in step 6.
mkdir -p mail-config
```

### 2. Fill in `.env`

Edit `.env` — see the [configuration reference](#part-2--configuration-reference-env).
At minimum set the domains, `ACME_EMAIL`, and all passwords.

> **Tip:** while testing DNS, set `ACME_CA` to the Let's Encrypt **staging**
> endpoint to avoid rate limits (certs will be untrusted — that's expected).

### 3. Log in to the registry and start

The proxy must come up **first**: the mail server is configured with
`SSL_TYPE=manual` and refuses to start until Caddy has written the
`mail.stigvidd.se` certificate to the shared `caddy_data` volume.

```bash
docker login inkaben.se          # username: stigvidd
docker compose pull
docker compose up -d proxy

# Wait for the mail certificate to exist, then bring up everything else.
docker compose exec proxy \
  ls /data/caddy/certificates/acme-v02.api.letsencrypt.org-directory/mail.stigvidd.se/
#   -> must list mail.stigvidd.se.crt and mail.stigvidd.se.key

docker compose up -d
```

On first start:

- `db` creates the app database and the `keycloak` database (`db/init/`).
- `api` runs its EF migrations (creates the PostGIS schema).
- `keycloak` migrates its schema.
- `proxy` obtains Let's Encrypt certificates for all five domains (seconds, once DNS is right).
- `mailserver` starts Postfix, Dovecot and Rspamd, reading its TLS certificate
  from the proxy's volume. It has **no mailboxes yet** — see step 6.

> **`mailserver` restart-looping on a first deploy is expected**, for either of
> two reasons — check its logs to tell them apart:
>
> - `You need at least one mail account to start Dovecot (Ns left…)` — Dovecot
>   will not start without an account, so the container exits after 120 seconds
>   and `restart: unless-stopped` gives it another 120-second window. Run step 6
>   inside one of those windows (`docker compose exec` works throughout); it
>   settles as soon as the first mailbox exists.
> - A missing certificate — if the `ls` above stayed empty, Caddy never issued
>   one. Check `docker compose logs proxy`; almost always the `mail.stigvidd.se`
>   A record is missing or port 80 is unreachable.

### 4. Verify

```bash
docker compose ps                 # all services Up / healthy
curl -I https://stigvidd.se       # web
curl -I https://api.stigvidd.se   # api
curl -I https://auth.stigvidd.se  # keycloak
curl -I https://mail.stigvidd.se  # cert-only site block; 200 "Stigvidd mail server"
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

### 6. Mail server (first deploy only)

A fresh mail server has no mailboxes and no DKIM key. Create them:

```bash
cd /opt/stigvidd

# Mailboxes. The no-reply password MUST match SMTP_NOREPLY_PASSWORD in .env —
# that is the account Keycloak authenticates as.
docker compose exec mailserver setup email add no-reply@stigvidd.se
docker compose exec mailserver setup email add info@stigvidd.se

# Aliases. postmaster and abuse are expected to exist by other mail systems.
docker compose exec mailserver setup alias add postmaster@stigvidd.se info@stigvidd.se
docker compose exec mailserver setup alias add abuse@stigvidd.se      info@stigvidd.se

# DKIM key. Defaults to RSA-2048 with selector `mail`, and prints the TXT
# record to publish as mail._domainkey.stigvidd.se. It restarts Rspamd itself.
docker compose exec mailserver setup config dkim domain stigvidd.se

# The same value, ready to paste into the registrar's TXT field:
cat mail-config/rspamd/dkim/rsa-2048-mail-stigvidd.se.public.dns.txt
```

Publish the `.public.dns.txt` contents, not `.public.txt` — the latter is BIND
zone format with the value split across quoted chunks. A 2048-bit key exceeds
the 255-character limit of a single TXT string; most registrars split it for
you, but if yours rejects it, re-run with `keysize 1024` appended.

Then check the rest of the [mail DNS records](#mail-dns-records) are in place —
`docker compose exec mailserver setup debug show-mail-logs` will show relay
rejections if SPF or the `_hostup` record is wrong.

### 7. Keycloak email settings (first deploy only)

Keycloak's SMTP configuration is **realm config stored in its database**, not
environment variables — so there is nothing in `.env` for it. Without this step
`POST /api/v1/account/forgot-password` silently does nothing (it always returns
204, whether or not the mail was sent).

In the admin console → realm `stigvidd` → **Realm settings → Email**:

| Field             | Value                                        |
|-------------------|----------------------------------------------|
| From              | `no-reply@stigvidd.se`                       |
| From display name | `Stigvidd`                                   |
| Reply to          | `info@stigvidd.se`                           |
| Host              | `mail.stigvidd.se`                           |
| Port              | `587`                                        |
| Enable StartTLS   | ✓                                            |
| Authentication    | ✓ — username `no-reply@stigvidd.se`, password = `SMTP_NOREPLY_PASSWORD` |

`mail.stigvidd.se` is a Docker network alias on the `mailserver` container, so
this resolves inside the stack and still matches the TLS certificate — the same
trick the proxy uses for the other hostnames. Use the **Test connection** button;
it reports TLS and auth failures immediately.

Because this lives in the `keycloak` database it survives every CI deploy and
travels with both migration methods in Part 4.

---

## Part 2 — Configuration reference (`.env`)

Copy [.env.example](.env.example) to `.env` and set:

| Variable | What |
|----------|------|
| `REGISTRY` / `IMAGE_TAG` | Image source. `inkaben.se` and the tag to run. `latest` (the default) tracks the current `main`; a 12-char commit sha pins one exact build. CI injects the sha at deploy time, overriding this. |
| `WEB_DOMAIN` / `API_DOMAIN` / `MEDIA_DOMAIN` / `AUTH_DOMAIN` | The four public hostnames. |
| `ACME_EMAIL` | Let's Encrypt contact address. |
| `ACME_CA` | Leave at production; switch to LE staging while testing. |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | Database. Keep identical to the source when restoring a backup. |
| `KEYCLOAK_URL` | Public issuer URL, e.g. `https://auth.stigvidd.se`. |
| `KEYCLOAK_DB` | Keycloak's database name (default `keycloak`). |
| `KC_ADMIN_USER` / `KC_ADMIN_PASSWORD` | First-boot Keycloak admin. Rotate after first login. |
| `WEBDAV_USER` / `WEBDAV_PASSWORD` | Credentials the API uses to write media. |
| `PRESENTABLE_BASE_URL` | Public media base URL, e.g. `https://media.stigvidd.se/` (trailing slash). |
| `MAIL_DOMAIN` | Mail server hostname, e.g. `mail.stigvidd.se`. Also the container's Docker network alias, so it must match the TLS certificate. |
| `MAIL_RELAY_HOST` / `MAIL_RELAY_PORT` | Hostup's smarthost (`relay.hostup.se:587`). No credentials — authorisation is by source IP via the `_hostup` TXT record. |
| `POSTMASTER_ADDRESS` | Required by the mail server; also where DMARC reports go. |
| `SMTP_NOREPLY_USER` / `SMTP_NOREPLY_PASSWORD` | The mailbox Keycloak (and later the API) submits mail as. Must match the account created in Part 1 step 6 **and** Keycloak's realm email settings. |
| `TZ` | Timezone for mail log timestamps (`Europe/Stockholm`). |
| `VITE_API_URL` / `VITE_OIDC_URL` / `VITE_OIDC_REALM` / `VITE_CLIENT_ID` | Baked into the web bundle at **build** time. |

> **`VITE_*` are build-time.** They are compiled into the web image by CI. With
> stable public domains you rarely change them, but if you do, the web image must
> be **rebuilt** (not just restarted).

Keep `.env` secret and out of git (it already is).

---

## Part 3 — CI/CD (Jenkins)

The pipeline ([Jenkinsfile](Jenkinsfile)) tests, builds & pushes all custom
images (`api web media proxy keycloak`) to `inkaben.se`, then deploys over SSH:
`docker compose pull && up -d --no-deps` for those five services on the target.
See the header of the Jenkinsfile for the full setup (credentials, plugins,
deploy-host prep).

### What a CI deploy touches

**Application code only.** The deploy step pulls and recreates exactly the five
images it builds — `api web media proxy keycloak` — and passes `--no-deps` so
compose never acts on `db` or `mailserver`.

Left alone: the `db` and `mailserver` services, and every named volume
(`pgdata`, `media`, `maildata`, `mailstate`, `maillogs`, `caddy_data`,
`caddy_config`). Recreating the five app containers does not disturb uploads,
mailboxes or issued certificates, and Keycloak's realm — including its SMTP
settings — survives because it lives in the untouched database.

The tradeoff is deliberate: **`postgis` and `docker-mailserver` version bumps in
`docker-compose.yml` are not applied by CI.** Both are upstream images holding
live state, so they stay manual — deploy the compose change, then on the host:

```bash
cd /opt/stigvidd && docker compose up -d db
cd /opt/stigvidd && docker compose up -d mailserver
```

Any change to the `mailserver` service block needs that second command too; a
normal CI deploy will not pick it up.

### Jenkins agent SSH prep

The agent trusts the deploy host via the **jenkins user's** `~/.ssh/known_hosts`.
If that entry is missing or stale — after a rebuilt agent, or a DNS change that
repoints the deploy domain at a different machine — the Deploy stage fails at its
first `ssh` with `Host key verification failed` and exit code 255, before it ever
authenticates. A wrong entry looks identical to a missing one.

Re-seed on the Jenkins host, removing first so no stale line is left to match:

```bash
sudo -u jenkins ssh-keygen -R stigvidd.se -f /var/lib/jenkins/.ssh/known_hosts
sudo -u jenkins sh -c 'ssh-keyscan -H stigvidd.se >> /var/lib/jenkins/.ssh/known_hosts'
sudo -u jenkins ssh-keygen -lf /var/lib/jenkins/.ssh/known_hosts -F stigvidd.se
```

Check that last fingerprint against the deploy host itself
(`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`) before trusting it —
`ssh-keyscan` records whatever answers on port 22. Keep the file owned by
`jenkins`; a root-owned `known_hosts` cannot be updated by ssh itself.

### Image tags

Every `main` build publishes each custom image under **two** tags:

- **`<12-char commit sha>`** — immutable. What the pipeline's own deploy step
  injects, so a deploy is always traceable to one commit and rollback is just
  re-running with the older sha.
- **`latest`** — moves to whatever `main` last built.

So a deploy host can leave `IMAGE_TAG=latest` in `.env` permanently and
`docker compose pull && docker compose up -d` will fetch the current `main`.
Note that a Jenkins deploy overrides the host `.env` with the commit sha for
that run, which is what the containers keep running until the next manual pull.

To pin a specific build by hand, set `IMAGE_TAG` to its sha in the host `.env`
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
`pgdata` (app **and** Keycloak databases), `media`, `maildata` and `mailstate`
volumes.

On the **source** (in the compose dir):

```bash
./scripts/migrate.sh backup stigvidd-data.tar.gz     # stops the stack, snapshots volumes
scp stigvidd-data.tar.gz .env docker-compose.yml  target:/opt/stigvidd/
scp -r db mail-config                              target:/opt/stigvidd/
docker compose up -d                                 # bring source back up (or leave down for cutover)
```

> `mail-config/` is a bind mount, not a volume, so `migrate.sh` does **not**
> carry it — copy it explicitly as above. It holds the mail accounts and the
> DKIM private key; lose it and you must recreate every mailbox and republish
> the DKIM TXT record.

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
6. **Switch DNS** — point all five subdomains at the new host. Caddy issues fresh
   certs automatically within seconds (production `ACME_CA`). Also update the
   `_hostup.stigvidd.se` TXT record to the **new** host's IP, and ask Hostup to
   set rDNS for it — until both are done, outbound mail is refused by the relay.
   The MX record needs no change if `mail.stigvidd.se` moved with the rest.
7. Decommission the old host once the new one is confirmed healthy.

### Post-migration verification

```bash
docker compose ps                                   # all Up
docker compose exec db psql -U stigvidd -d stigvidd -c "SELECT count(*) FROM trails;"
docker compose exec db psql -U stigvidd -d keycloak -tAc "SELECT count(*) FROM user_entity;"
curl -I https://media.stigvidd.se/<some/known/image/path>   # 200
# sign in to the web admin and confirm content + that login (Keycloak) works

# Mail: TLS presents the right cert, and outbound reaches the relay.
openssl s_client -connect mail.stigvidd.se:587 -starttls smtp \
  -servername mail.stigvidd.se </dev/null 2>&1 | grep -E 'subject=|Verify return'
docker compose exec mailserver swaks \
  --to <your-external-address> --from no-reply@stigvidd.se --server localhost
docker compose logs mailserver | grep relay.hostup.se       # expect status=sent
```

Then send a mail *to* `info@stigvidd.se` from an outside account and check
`docker compose exec mailserver setup debug show-mail-logs` for
`status=sent (delivered to maildir)`. Finally, trigger the real path — the
**Forgot password** flow in the web admin — and confirm the message arrives;
the API returns 204 either way, so the mail log is the only evidence.

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

### Mail

**`mailserver` restart-loops.**
Two causes; the logs distinguish them. If it reports `You need at least one mail
account to start Dovecot`, it is exiting after 120 seconds because no mailbox
exists — create one (Part 1 step 6) and it settles. Otherwise it is the
certificate: `SSL_TYPE=manual` will not start without the files, and Caddy must
have issued `mail.stigvidd.se` first (Part 1 step 3). Confirm with
`docker compose exec proxy ls /data/caddy/certificates/…/mail.stigvidd.se/`.

**`mailserver` won't start after switching `ACME_CA` to staging.**
`SSL_CERT_PATH` / `SSL_KEY_PATH` in `docker-compose.yml` hard-code the
*production* issuer directory (`acme-v02.api.letsencrypt.org-directory`). LE
staging writes to `acme-staging-v02.api.letsencrypt.org-directory` instead.
Either keep production `ACME_CA`, or change both paths to match.

**Outbound mail sits in the queue / is rejected by the relay.**
Check `docker compose exec mailserver setup debug show-mail-logs`, then in order:
the `_hostup.stigvidd.se` TXT record must contain **this host's current public
IP** (`v=mc1 auth=<ip>`); the SPF record must include `spf.hostup.se`; and there
must be exactly **one** SPF TXT record on the domain. Also confirm
`RELAY_USER`/`RELAY_PASSWORD` are still unset — Hostup authorises by IP, and
setting either makes Postfix demand credentials the relay will not accept.
Inspect the queue with `docker compose exec mailserver postqueue -p`.

**Mail is delivered but lands in spam.**
Check a Gmail delivery's *Show original* for SPF/DKIM/DMARC. A missing
`mail._domainkey.stigvidd.se` record is the usual cause — regenerate and
republish per Part 1 step 6. Ask Hostup to set rDNS for the host IP if it does
not already resolve to `mail.stigvidd.se`.

**Keycloak's "Test connection" fails.**
Confirm the mailbox exists (`docker compose exec mailserver setup email list`)
and that its password matches `SMTP_NOREPLY_PASSWORD`. The host must be
`mail.stigvidd.se` on port 587 with StartTLS — the container name `mailserver`
also resolves, but does not match the certificate, so TLS verification fails.

**The mail server uses too much memory.**
First make sure it actually does: `docker stats` reports ~1 GB for this
container, but that counts Rspamd's five workers' shared mmap'd maps once per
worker. Measured PSS at idle is ~160 MB. The real figure is

```bash
docker compose exec mailserver sh -c \
  'awk "/^Pss:/ {s+=\$2} END {print s/1024 \" MB\"}" /proc/[0-9]*/smaps_rollup'
```

If it is genuinely too high, Rspamd is the component to drop. Swapping it for
connection-level filtering costs you content scoring — spam relayed through a
*reputable* host will then reach the inbox. In the `mailserver` environment
block:

```yaml
      ENABLE_RSPAMD: "0"
      ENABLE_AMAVIS: "0"        # stays off; upstream defaults it ON and it is Perl-heavy
      ENABLE_OPENDKIM: "1"      # back on — something must sign outbound DKIM
      ENABLE_OPENDMARC: "1"
      ENABLE_POLICYD_SPF: "1"
      ENABLE_POSTGREY: "1"      # replaces RSPAMD_GREYLISTING; delays first contact 300s
      # ENABLE_DNSBL / POSTSCREEN_ACTION / ENABLE_FAIL2BAN unchanged
```

Drop the four `RSPAMD_*` variables. This moves DKIM signing from Rspamd to
OpenDKIM, which stores keys elsewhere — re-run
`docker compose exec mailserver setup config dkim domain stigvidd.se`, then
republish the record from `mail-config/opendkim/keys/stigvidd.se/mail.txt`
(not the `rspamd/dkim/` path). Apply with
`docker compose up -d mailserver` — CI will not do it for you.
