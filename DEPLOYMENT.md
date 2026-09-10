# Deploying & Migrating Stigvidd

> Setting up **staging**? [STAGING.md](STAGING.md) is the runbook for that. Staging is a
> partial stack — five services of its own, borrowing production's Keycloak, mail server and
> OpenObserve — so it differs from this document in ways that matter. Read this one first for
> the mechanics; follow that one for the steps.

How to stand up the full Stigvidd stack on a new host and move data between
hosts. The whole environment is defined by [docker-compose.yml](docker-compose.yml)
and is designed to be picked up and moved at will.

- [The stack](#the-stack)
- [Prerequisites](#prerequisites) · [Mail DNS records](#mail-dns-records)
- [Part 1 — Deploy to a new host](#part-1--deploy-to-a-new-host)
- [Part 2 — Configuration reference](#part-2--configuration-reference-env)
- [Direct database access (published 5432)](#direct-database-access-published-5432)
- [Part 3 — CI/CD (Jenkins)](#part-3--cicd-jenkins)
- [Part 4 — Migrating data](#part-4--migrating-data)
- [Part 5 — Cutover checklist](#part-5--cutover-checklist)
- [Troubleshooting](#troubleshooting)

---

## The stack

Eight services on two networks. Only the proxy and the mail server are exposed
to the internet.

| Service      | Image                     | Role                                            |
|--------------|---------------------------|-------------------------------------------------|
| `proxy`      | `stigvidd-proxy` (Caddy)  | TLS termination + Let's Encrypt, routes subdomains. Only service on 80/443. |
| `web`        | `stigvidd-web` (nginx)    | React admin SPA.                                 |
| `api`        | `stigvidd-api` (.NET 10)  | Backend API. Runs EF migrations on startup.     |
| `media`      | `stigvidd-media` (nginx)  | WebDAV media server (authed writes, public reads). |
| `keycloak`   | `stigvidd-keycloak`       | Identity provider. Sends the password-reset emails. |
| `openobserve`| `openobserve` v0.92.2     | Telemetry at observatory.<domain>: logs, traces, metrics and mobile RUM. Ingests from the API (in-stack OTLP) and from the apps (public HTTPS). Upstream image — **not** built by CI. |
| `mailserver` | `docker-mailserver` 15.1.0 | Mail for the domain: inbound on 25, submission on 465/587, IMAPS on 993. Upstream image — **not** built by CI. |
| `db`         | `postgis/postgis:17-3.5`  | PostgreSQL + PostGIS. Holds **both** the app database and Keycloak's. |

**What is stateful** (i.e. what must be migrated):

- **`pgdata` volume** — the app database *and* the `keycloak` database live here.
  Keycloak's SMTP settings are realm config, so they live here too.
- **`media` volume** — uploaded images.
- **`trail_imports` volume** — uploaded trail-import source exports awaiting
  review. Stateful because a review session is re-analysed from the file it was
  created from, days after the upload. Migrated by `migrate.sh`.
- **`observatory` volume** — telemetry (parquet, WAL, and OpenObserve's own
  SQLite metadata DB holding users, ingest credentials and stream settings).
  *Not* migrated by `migrate.sh`: it is potentially the largest volume in the
  stack and its contents are, by definition, disposable history. The cost of
  skipping it is that the ingest accounts, the RUM application and the metrics
  retention override must be recreated on the new host — step 8, about two
  minutes.
- **`maildata` volume** — mailboxes.
- **`mailstate` volume** — Rspamd/Redis/fail2ban state (spam training, etc.).
- **`caddy_data` volume** — issued TLS certs. *Not* migrated; Caddy re-issues on the new host.
- **`maillogs` volume** — not migrated.

Everything else (images, compose file, `db/` init scripts) is reproducible. The
files you carry by hand are **`.env`**, **`mail-config/`** (mail accounts,
aliases and the DKIM private key) and **`db-certs/`** (the Postgres server key
for the published 5432) — all git-ignored, all secret. `db-certs/` is the only
one of the three that can simply be regenerated on the new host instead
(`./scripts/db-cert.sh <domain>`), because the certificate is self-signed.

### Domains

Each subdomain needs a public DNS record pointing at the host:

| Domain (default)      | → service  |
|-----------------------|------------|
| `stigvidd.se`         | web        |
| `api.stigvidd.se`     | api        |
| `media.stigvidd.se`   | media      |
| `auth.stigvidd.se`    | keycloak   |
| `observatory.stigvidd.se` | openobserve |
| `mail.stigvidd.se`    | mailserver |

Mail additionally needs MX, SPF, DKIM, DMARC and a Hostup authorisation record —
see [Mail DNS records](#mail-dns-records).

---

## Prerequisites

On the **target host**:

- Docker Engine + Docker Compose v2, and the user in the `docker` group.
- Network access to the private registry `inkaben.se`, to `ghcr.io` (the mail
  server image) and to `public.ecr.aws` (the OpenObserve image).
- **DNS**: all six subdomains resolve to this host's public IP, with **ports 80
  and 443 reachable** (required for Let's Encrypt to issue certificates).
- **No system MTA on the host.** Most VPS images ship Postfix or Exim enabled,
  which holds port 25 and stops the mail container binding it. Remove it before
  the first start:

  ```bash
  sudo ss -lptn 'sport = :25'            # expect no output
  sudo systemctl disable --now postfix   # or exim4, if present
  ```

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

- **Disk (telemetry)**: OpenObserve stores compressed parquet, roughly 10–20×
  smaller than the raw JSON ingested. With **logs and traces at 7 days** that
  working set stays small — a few hundred MB plus WAL. **Metrics at 730 days**
  become the dominant consumer within a few months; expect low single-digit GB at
  two years for a service this size, driven by *series cardinality* rather than
  the time window. Check the real number rather than trusting that estimate:

  ```bash
  docker system df -v | grep observatory
  ```

  Its resident memory is capped at ~512 MB by the `ZO_MEM_TABLE_MAX_SIZE` and
  `ZO_MEMORY_CACHE_MAX_SIZE` settings in `docker-compose.yml`; left at their
  upstream defaults **each** would claim 50% of the host's RAM.

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
>
> ### The Keycloak admin client secret does it a third time
>
> `KEYCLOAK_ADMIN_CLIENT_SECRET` is `${…:?}`-guarded on `api`, so the same trap applies
> once more — until it exists in `/opt/stigvidd/.env`, *every* compose command on that
> host fails, the CI deploy's `pull`/`up` included. Add it **before** merging:
>
> ```bash
> cd /opt/stigvidd
> cat >> .env <<'EOF'
> KEYCLOAK_ADMIN_CLIENT_SECRET=<stigvidd-admin-api's secret, from its Credentials tab>
> EOF
> ```
>
> This value previously lived in `backend/StigviddAPI/appsettings.json`, which is a public
> file — so regenerate the secret in Keycloak rather than copying the old one across, and
> put the new value here.
>
> ### Observability does the same thing again
>
> `OBSERVATORY_DOMAIN`, `OBSERVATORY_ROOT_EMAIL` and `OBSERVATORY_ROOT_PASSWORD`
> are `${…:?}`-guarded on `proxy` and `openobserve`, so the same trap applies —
> until they exist in `/opt/stigvidd/.env`, *every* compose command on that host
> fails. Add them **before** merging, and publish the `observatory.stigvidd.se`
> A record at the same time:
>
> ```bash
> cd /opt/stigvidd
> cat >> .env <<'EOF'
> OBSERVATORY_DOMAIN=observatory.stigvidd.se
> OBSERVATORY_ROOT_EMAIL=admin@stigvidd.se
> OBSERVATORY_ROOT_PASSWORD=<see the password policy note below>
> OBSERVATORY_ORG=default
> OBSERVATORY_RETENTION_DAYS=7
> OBSERVATORY_METRICS_RETENTION_DAYS=730
> EOF
> ```
>
> **The root password must satisfy OpenObserve's policy** — 8–128 characters with
> at least one lowercase, one uppercase, one digit and one special character. A
> weaker value does not warn: the container panics with `backend job init failed`
> and never binds a port.
>
> After the CI deploy lands the new compose file and proxy image,
> `observatory.stigvidd.se` will answer **502** until you start the container —
> that is expected, not a fault. CI does not start it (see Part 3):
>
> ```bash
> docker compose up -d openobserve
> ```
>
> Then do step 8 to create the ingest credentials.
>
> ### Container log retention is new, and applies to hosts that already exist
>
> `docker-compose.yml` now caps every service's log size, and
> `CONTAINER_LOG_RETENTION_DAYS` (default 7) sets how long container logs are kept.
> Neither is `${…:?}`-guarded, so nothing breaks if you skip this — which is
> exactly the problem: the privacy policy is published stating 7 days, and until
> the timer in **step 9** is installed on this host, nothing deletes anything. Do
> step 9 on every existing host, not just new ones. Optionally pin the window
> explicitly:
>
> ```bash
> cd /opt/stigvidd
> echo 'CONTAINER_LOG_RETENTION_DAYS=7' >> .env
> ```
>
> The size caps take effect only on containers **recreated** after the new compose
> file lands (`docker compose up -d` does that); an untouched container keeps the
> unbounded log config it was created with. `docker inspect --format
> '{{.HostConfig.LogConfig}}' $(docker compose ps -q api)` shows which you have.

### 1. Get the deploy files onto the host

You need `docker-compose.yml`, the `db/` directory, `scripts/`, and a `.env`.
Create a working directory (the compose "project" dir), e.g. `/opt/stigvidd`:

```bash
mkdir -p /opt/stigvidd && cd /opt/stigvidd
# copy docker-compose.yml, db/ and scripts/ here (git checkout, scp, or Jenkins deploy)
cp /path/to/repo/docker-compose.yml .
cp -r /path/to/repo/db .
cp -r /path/to/repo/scripts .
chmod +x scripts/*.sh
cp /path/to/repo/.env.example .env
# The mail server's config dir. Empty is fine — it is filled in step 6.
mkdir -p mail-config
```

> **`scripts/` is easy to miss and nothing complains until you need it.** Steps 8
> and 9 below, `db-cert.sh` and `migrate.sh` are all invoked as
> `./scripts/<name>.sh` **from this directory**. The Jenkins deploy `scp`s them
> alongside `docker-compose.yml` (Part 3), so once the stack is live they stay
> current on their own — but on a brand-new host, before the first deploy, they
> only get here because you put them here.

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
- `proxy` obtains Let's Encrypt certificates for all six domains (seconds, once DNS is right).
- `openobserve` initialises its data directory and creates the root user from
  `OBSERVATORY_ROOT_*` — **first boot only**; changing those values later does
  nothing, and a password failing the complexity policy panics the container.
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
curl -I https://observatory.stigvidd.se        # OpenObserve UI (login page)
curl -s  https://observatory.stigvidd.se/healthz   # {"status":"ok"}
```

`openobserve` shows as `Up` but never `healthy` — it has no healthcheck, on
purpose. The image is distroless (no shell, no curl, no wget inside it), so there
is nothing to probe with; the `/healthz` call above is the check.

### 5. Keycloak realm (first deploy only)

A fresh Keycloak is empty. The app expects realm `stigvidd` with clients
`stigvidd-api`, `stigvidd-admin-api`, `stigvidd-admin`. Either:

- **Import an existing realm export** (keeps the client secrets that are already
  deployed) — recommended, or
- Recreate the realm/clients by hand in the admin console at
  `https://auth.stigvidd.se/admin` (log in with `KC_ADMIN_USER` /
  `KC_ADMIN_PASSWORD`).

Grant your admin user the **`admin` realm role** — the web Migration page and
its API endpoints require it.

Either way, copy `stigvidd-admin-api`'s secret from its **Credentials** tab into
`KEYCLOAK_ADMIN_CLIENT_SECRET` in `.env`. The client secrets used to live in
`backend/StigviddAPI/appsettings.json` and no longer do — that file is public, and
anything that was ever in it has to be treated as disclosed and regenerated.

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

### 8. OpenObserve (first deploy only)

A fresh OpenObserve has the `default` organisation and the root user from
`OBSERVATORY_ROOT_*`, and nothing else. Sign in at
`https://observatory.stigvidd.se` and create the accounts below.

> **Read this before creating anything.** OpenObserve OSS **has no RBAC** — the
> UI offers roles, but the only value it accepts is `Admin`, and every account is
> a full admin regardless of what you pick. (`Member`, which earlier versions of
> this runbook told you to choose, is rejected outright with "Custom roles not
> allowed"; `service_account` is accepted and silently stored as `admin`.)
>
> The **only** privilege boundary that exists here is the *ingestion token* — the
> per-user "passcode" on the **Ingestion** page, which is a different secret from
> the account's login password. Measured against v0.92.2, for one and the same
> account:
>
> | credential | `_json` / OTLP ingest | `/_search` | `/users` |
> | --- | --- | --- | --- |
> | ingestion token (passcode) | 200 | **401** | **401** |
> | login password | 200 | **200** — reads every stream | **200** — creates admin users |
>
> So an ingestion token is safe to ship in a public binary and a password is not,
> and that is the whole reason the steps below hand out tokens. Never put an
> account password into `.env`, `app/.env` or a build arg. See
> [docs/notes/openobserve-oss-has-no-rbac.md](docs/notes/openobserve-oss-has-no-rbac.md).

**a. Create four accounts.** *IAM → Users → Add*, role `Admin` (the only option),
one per producer — separate accounts so that a token extracted from a public
bundle is not also the backend's, and so one can be rotated without disturbing
the others:

| account | used by | credential it hands out |
| --- | --- | --- |
| `api@stigvidd.se` | the backend API | ingestion token |
| `app@stigvidd.se` | the mobile app | ingestion token — **public** |
| `web@stigvidd.se` | the admin web | ingestion token — **public** |
| `ops@stigvidd.se` | `scripts/observatory-retention.sh` | password (see **d**) |

**b. The backend's ingestion token.** Sign in **as `api@stigvidd.se`**, open
*Ingestion*, and copy the Authorization value — it is already
`base64("api@stigvidd.se:<passcode>")`. The passcode is per user and per
organisation, so it has to be fetched while signed in as that user; root cannot
read someone else's. Put it in the host `.env`:

```bash
OTLP_ENDPOINT=http://openobserve:5080/api/default
OTLP_TOKEN=<the value copied from the Ingestion page>
```

Then restart the API so it picks them up. Until this is done it runs with **no
exporter at all**, which is the intended fallback, not a failure:

```bash
docker compose up -d --no-deps api
```

Confirm it worked by watching for the absence of failures — an OTLP export error
never surfaces as an application error, so a wrong token looks exactly like
telemetry being switched off:

```bash
docker compose logs --tail=50 api | grep -i otlp   # expect nothing
```

then check that `stigvidd_api_logs` is filling in the UI.

**c. The two public tokens.** Repeat **b** signed in as `app@stigvidd.se` and
`web@stigvidd.se`.

> **Both of these ship inside something the public can read**, and are therefore
> public themselves: the app's is inlined into every APK and IPA by Metro, and the
> web's is inlined into the JS bundle by Vite and served from the web domain — that
> one needs no APK to extract, just a `curl`. That is the accepted trade for
> direct-from-client telemetry; what makes it acceptable is that an ingestion token
> **cannot read or administer anything** (the table above), plus the retention caps,
> `request_body max_size 10MB` in the Caddyfile, and `ZO_INGEST_ALLOWED_UPTO`. If one
> is abused, reset that user's passcode on the Ingestion page and ship a new build.

The web token is a **build arg**, not runtime config, because Vite inlines it:

```bash
VITE_OO_LOGS_URL=https://observatory.stigvidd.se/api/default/stigvidd_web_logs/_json
VITE_OO_LOGS_TOKEN=<the value copied while signed in as web@>
```

The app's goes on EAS, not in this `.env` — `app/.env` is git-ignored and a cloud
build never sees it, so it must be `eas env:create`d per environment. See the
**Telemetry** section of the root [README.md](README.md).

**Rotating any of these three:** reset the passcode on that user's Ingestion page,
then update the value. The API needs only a restart; the **app and web need a
rebuild and redeploy**, because their tokens are compiled in. Jenkins builds and
deploys only from `main`.

**d. The ops account for the retention script.** Changing stream settings is not
an ingest route, so `scripts/observatory-retention.sh` cannot use an ingestion
token at all — a passcode gets a 401 there. It needs an account password, which on
OSS is unavoidably full admin. Use `ops@stigvidd.se` rather than root anyway: the
root password is the first-boot `ZO_ROOT_USER_PASSWORD` and editing `.env` cannot
change it afterwards, so it is the one credential here that **cannot be rotated**.

```bash
OBSERVATORY_OPS_EMAIL=ops@stigvidd.se
OBSERVATORY_OPS_PASSWORD=<the ops account's password>
```

The script falls back to `OBSERVATORY_ROOT_*` when these are unset, so a host
provisioned before this step existed keeps working unchanged.

**e. A RUM application for the mobile apps.** *Ingestion → RUM → New
application*, named `stigvidd-app`. It produces an `applicationId` and a
`clientToken`, which the app build needs.

> The RUM `clientToken` is a **third** kind of credential — per organisation, not
> per user, and distinct from both the passcode and any password. It authorises
> only `/rum/v1/<org>/{rum,logs,replay}`. It is public for the same reason as **c**.
> They must **never** be the same credentials the backend uses.

**f. The metrics retention override.** The global default gives logs and traces
their 7 days. Metrics are kept for two years, which OpenObserve can only express
as a per-stream override:

```bash
./scripts/observatory-retention.sh --dry-run   # preview
./scripts/observatory-retention.sh             # apply
```

> **Re-run this after any change that adds new instrumentation.** A metrics stream
> is created the first time that metric is *ingested*, so a stream that did not
> exist when the script last ran is still on the 7-day global and will silently
> lose history. The script is idempotent, so re-running it is always safe.
>
> It also warns about any metrics field that looks like personal data. **The
> 730-day window is lawful only because metrics contain none** — see
> [docs/observability.md](docs/observability.md). Treat a warning as a release
> blocker, not a cleanup task.

None of this lives in `.env` or in the database the other services share — it is
stored in OpenObserve's own SQLite metadata DB inside the `observatory` volume,
which `migrate.sh` does **not** carry. Redo this step after a host move.

---

### 9. Container log retention timer (every host)

The privacy policy published at `stigvidd.se/privacy-policy/` states a number —
"Serverloggar: 7 dagar" / "Server logs: 7 days" (§5, both languages) — and
container logs are personal data: `db` runs with `log_connections=on` behind a
publicly published 5432, so every connection attempt is recorded with its source
IP. Step 8 covers the OpenObserve *streams*. This step covers the **host's own
container logs**, which are a different mechanism entirely.

> **Docker's `json-file` driver has NO time-based retention.** The `max-size` /
> `max-file` caps set by the `x-logging` anchor in `docker-compose.yml` bound
> **disk**, not **age** — under any size cap a quiet service keeps its oldest line
> forever, and the driver's own default is no rotation at all. So the caps are half
> the promise. [`scripts/container-log-retention.sh`](scripts/container-log-retention.sh)
> is the other half, and unlike `observatory-retention.sh` **it must recur**: a
> single manual run is the failure mode, because nothing afterwards reports that
> logs have aged past the window. The stack keeps working and the published policy
> quietly stops being true.

> **A CI deploy applies the size caps to only five of the eight services.** The
> deploy `up -d` is scoped to `api web media proxy keycloak --no-deps` (Part 3), and
> log options are fixed at container **create** time — so `db`, `mailserver` and
> `openobserve` keep the unbounded log config they were created with until you
> recreate them by hand. `db` is the one that matters most here: it is the service
> logging a source IP per connection attempt. On the deploy that introduces this:
>
> ```bash
> cd /opt/stigvidd
> docker compose up -d --no-deps db mailserver openobserve
> for s in db api web media keycloak openobserve proxy mailserver; do
>   printf '%-12s %s\n' "$s" "$(docker inspect --format '{{.HostConfig.LogConfig}}' $(docker compose ps -q $s))"
> done
> ```
>
> **`--no-deps` is not optional here.** `mailserver` depends on `proxy`, which
> depends on `web`/`api`/`media`, which depend on `db` — so naming `mailserver`
> without it pulls in most of the stack and restarts it.
> Same trap as "Restarting `mailserver` restarts half the stack" in Troubleshooting.
>
> Every line must show `max-size:10m`. A bare `map[]` on **all eight** means the
> containers were never replaced, and the usual cause is that the host's
> `docker-compose.yml` predates the anchor — check with
> `grep -c max-size docker-compose.yml` before recreating anything again. Compose
> reports an up-to-date container as `Running`, not `Recreated`, so a run that
> changed nothing looks much like one that did.
>
> Recreating `db` restarts the database — brief downtime, and `pgdata` is
> untouched. The recreation also *discards* the old container's log file, which is
> the backlog this change exists to bound; the script below prunes that backlog on
> containers you have not recreated yet.

Check what it would do first — it needs root, since `/var/lib/docker/containers`
is `0700`:

```bash
sudo ./scripts/container-log-retention.sh --dry-run
```

Then install a daily timer. `Persistent=true` matters: it makes the run happen on
the next boot if the host was down when it was due.

```bash
sudo tee /etc/systemd/system/stigvidd-log-retention.service >/dev/null <<'UNIT'
[Unit]
Description=Age out Stigvidd container logs to the published retention window
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
# The compose directory: the script runs `docker compose ps` and reads ./.env
WorkingDirectory=/opt/stigvidd
ExecStart=/opt/stigvidd/scripts/container-log-retention.sh
UNIT

sudo tee /etc/systemd/system/stigvidd-log-retention.timer >/dev/null <<'UNIT'
[Unit]
Description=Daily Stigvidd container log retention

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now stigvidd-log-retention.timer
```

Adjust `WorkingDirectory`/`ExecStart` if the stack does not live in `/opt/stigvidd`.
Verify:

```bash
systemctl list-timers stigvidd-log-retention.timer   # NEXT/LEFT must be populated
sudo systemctl start stigvidd-log-retention.service  # run it once now
journalctl -u stigvidd-log-retention.service -n 30 --no-pager
```

The window comes from `CONTAINER_LOG_RETENTION_DAYS` in `.env` (default 7).
**Raising it without editing §5 of the privacy policy in both languages makes a
published legal document false**, so treat the two as one change.

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
| `DB_PUBLIC_PORT` | Host port Postgres is **published** on (default `5432`), reachable from any IP that can reach this host — see [Direct database access](#direct-database-access-published-5432). Named this rather than `POSTGRES_PORT` so it is never confused with libpq's `PGPORT`. Moving it (e.g. `5433`) is noise reduction, not security. |
| `KEYCLOAK_URL` | Public issuer URL, e.g. `https://auth.stigvidd.se`. |
| `KEYCLOAK_ADMIN_CLIENT_SECRET` | Secret of the confidential `stigvidd-admin-api` client, from its **Credentials** tab in the `stigvidd` realm. The API mints its Keycloak Admin API token with it, so registration, forgot-password and admin user provisioning fail at runtime without it. It is **not** in `appsettings.json` — that file is public. Rotating it in Keycloak means updating it here too. |
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
| `OBSERVATORY_DOMAIN` | OpenObserve's public hostname, e.g. `observatory.stigvidd.se`. Also a proxy network alias. **Never leave blank** — an empty site address makes Caddy refuse its whole config, taking every domain down. |
| `OBSERVATORY_ROOT_EMAIL` / `OBSERVATORY_ROOT_PASSWORD` | First-boot OpenObserve root account; created only while `observatory` is empty. Full admin over all telemetry and credentials — treat like `KC_ADMIN_PASSWORD`. The password **must** be 8–128 chars with lower, upper, digit and special, or the container panics on startup. |
| `OBSERVATORY_ORG` | Organisation telemetry is written into (`default`). Part of the OTLP URL path. |
| `OBSERVATORY_RETENTION_DAYS` | **Logs and traces** retention (default 7). This is the *global* default and the only one OpenObserve has; upstream's own default is 3650, so do not remove it. Minimum 3. |
| `OBSERVATORY_METRICS_RETENTION_DAYS` | **Metrics** retention (default 730), applied as a per-stream override by `scripts/observatory-retention.sh`. Lawful only while metrics carry no personal data — see [docs/observability.md](docs/observability.md). |
| `OTLP_ENDPOINT` | **The telemetry on/off switch.** Unset (the default in `.env.example`) = the API registers no telemetry providers at all and behaves exactly as before. In-stack OTLP target when set: `http://openobserve:5080/api/default`. |
| `OTLP_TOKEN` | **Required once `OTLP_ENDPOINT` is set, and secret.** The `api@` account's INGESTION TOKEN from Part 1 step 8 — already `base64("user:passcode")`, passed through verbatim. **Not a login password:** OSS has no RBAC, so a password would also read every stream and create admin users. Setting the endpoint without a credential is a configuration error and the API **refuses to start**, rather than running an exporter that would 401 every batch silently. |
| `OTLP_USER` / `OTLP_PASSWORD` | Legacy fallback, still accepted, for a local throwaway instance only. `OTLP_TOKEN` wins when both are present, so a host that still carries this pair is not silently left on the weaker credential. |
| `OTLP_LOG_STREAM` | Stream the API's logs land in (default `stigvidd_api_logs`). |
| `OBSERVATORY_OPS_EMAIL` / `OBSERVATORY_OPS_PASSWORD` | Account `scripts/observatory-retention.sh` authenticates as. A **password**, necessarily: stream settings are not an ingest route, so an ingestion token gets a 401 there. Falls back to `OBSERVATORY_ROOT_*` when unset. Preferred over root because the root password is first-boot-only and cannot be rotated. |
| `VITE_OO_LOGS_URL` / `VITE_OO_LOGS_TOKEN` | Admin-web telemetry, optional; with either unset the bundle installs no sink. **Build args, not runtime config** — Vite inlines them, so changing one needs a web image rebuild. The token is the `web@` account's ingestion token and is **public**: it is served in a JS bundle anyone can fetch. |

> **`VITE_*` are build-time.** They are compiled into the web image by CI. With
> stable public domains you rarely change them, but if you do, the web image must
> be **rebuilt** (not just restarted).

> **The mobile app's telemetry config is not here.** `EXPO_PUBLIC_OO_LOGS_*` and the
> RUM `applicationId` / `clientToken` are compiled into the mobile binary by EAS, not
> by this compose file — `app/.env` is git-ignored and a cloud build never sees it, so
> they must be `eas env:create`d. Changing them needs a new app build, and they are
> public once shipped.

Keep `.env` secret and out of git (it already is).

---

## Direct database access (published 5432)

The `db` service **publishes `${DB_PUBLIC_PORT:-5432}` on the host's public IP**,
so pgAdmin (or `psql`, DataGrip, DBeaver) connects to `stigvidd.se:5432` from
anywhere. This is deliberate. It is also the only service in the stack other than
the proxy and the mail server that is reachable from the internet, so read the
risk paragraph before you widen it further.

### What protects it

Two things, and nothing else:

1. **Postgres' own authentication.** Every connection arriving over the network
   matches the image's last `pg_hba` rule, `host all all all scram-sha-256`, so a
   password is required. Measured: a wrong password gives
   `FATAL: password authentication failed` and is logged. The `trust` rules in
   that file cover `127.0.0.1`/`::1` **inside the container** only — which is why
   `docker compose exec db psql -U stigvidd` needs no password and an external
   client does. Never set `POSTGRES_HOST_AUTH_METHOD`: `trust` there would replace
   that last rule and leave the database open to the internet with no password at
   all, and nothing in the stack would report it.
2. **TLS.** `docker-compose.yml` starts Postgres with `-c ssl=on` and the
   certificate from `./db-certs`, so queries and results are encrypted (measured:
   TLSv1.3 / `TLS_AES_256_GCM_SHA384`). The certificate is **self-signed**, so
   clients use SSL mode `require` — encrypted, identity unverified. Without this
   every row you browse would cross the internet in clear text.

`log_connections`/`log_disconnections` are on, so `docker compose logs db` is the
record of who connected and of the brute-force traffic a public 5432 attracts.

> **The risk, stated plainly.** This Postgres instance holds the **`keycloak`
> database as well as the app's** — realms, users and `user_entity` credential
> hashes. Publishing 5432 puts the identity store behind `POSTGRES_PASSWORD`
> alone. Use a long random `POSTGRES_PASSWORD`, do interactive work as the
> read-only role below rather than as the owner, and check the log for
> `password authentication failed` occasionally. If the exposure is ever no
> longer wanted, delete the `ports:` block from the `db` service and run
> `docker compose up -d db` — nothing else depends on it.

### First-time setup on a host

The certificate must exist **before** the container is recreated: `ssl=on` with
the files missing means Postgres *refuses to start*, and `restart: unless-stopped`
turns that into a restart loop.

```bash
cd /opt/stigvidd

# 1. Server certificate. The CN/SAN should be the name clients will use.
./scripts/db-cert.sh stigvidd.se

# 2. The key must be readable by the postgres user (uid 999) inside the
#    container and by nobody else. The script says so if it could not do it
#    itself, which it cannot when run as a non-root user:
sudo chown 0:999 db-certs/server.key    # root-owned, mode 0640 — the one
                                        # combination a bind mount can offer

# 3. Recreate the database container. CI NEVER does this for you (Part 3).
docker compose up -d db

# 4. Confirm.
docker compose exec db psql -U stigvidd -d stigvidd -tAc 'show ssl'   # -> on
docker compose ps db                                                 # -> published 5432, healthy
```

Recreating `db` drops the API's open connections for a few seconds. Npgsql
reconnects on its own, but do it in a quiet window, and check
`curl -s https://api.stigvidd.se/readyz` afterwards — `/readyz` is the probe that
actually touches the database.

### A read-only role to browse with

Connecting as `stigvidd` means every session can `DROP TABLE`. `db/init/` runs
**only on an empty data directory**, so on an existing host this is a hand-run
snippet — the same situation as `createdb keycloak` in
[db/init/02-keycloak-db.sql](db/init/02-keycloak-db.sql):

```bash
docker compose exec db psql -U stigvidd -d stigvidd
```

```sql
CREATE ROLE stigvidd_ro LOGIN PASSWORD 'pick-a-strong-secret';
GRANT CONNECT ON DATABASE stigvidd TO stigvidd_ro;
GRANT USAGE ON SCHEMA public TO stigvidd_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO stigvidd_ro;
-- Without this line every table a FUTURE EF migration creates is invisible to
-- the role, which looks like missing data rather than missing privilege.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO stigvidd_ro;
```

The role is not carried by `.env` and is not recreated by anything, so it lives
in `pgdata` — a Method B volume copy brings it along, a fresh database does not.

### pgAdmin

Register a server with:

| Field | Value |
|-------|-------|
| Host | `stigvidd.se` |
| Port | `5432` (whatever `DB_PUBLIC_PORT` is) |
| Maintenance database | `stigvidd` |
| Username | `stigvidd_ro`, or `stigvidd` when you need to write |
| Password | that role's password |
| SSL mode | **Require** |

`Require` is correct for a self-signed certificate. `Verify-CA`/`Verify-Full`
will fail unless you also hand pgAdmin the certificate as a root CA — the
fingerprint `./scripts/db-cert.sh` printed is what to check it against.

Keycloak's database is reachable the same way: same host and credentials,
maintenance database `keycloak`.

From a shell, the equivalent is:

```bash
psql "postgresql://stigvidd_ro@stigvidd.se:5432/stigvidd?sslmode=require" -c 'select count(*) from trails'
```

### If you want a publicly-trusted certificate instead

Caddy already holds a Let's Encrypt cert for the stack's domains in the
`caddy_data` volume, but Postgres cannot use it as-is: it needs the key at
`0640` owned by root or `0600` owned by uid 999, and it re-reads the files only
on restart, so each renewal would need a copy-and-`chown` step plus a `db`
restart. The proxy image is plain `caddy:2-alpine`, so TCP passthrough
(`layer4`) is not available either. Self-signed plus `sslmode=require` is the
deliberate trade; publish a `db.stigvidd.se` record and wire the renewal hook
only if `verify-full` becomes a requirement.

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
compose never acts on `db`, `mailserver` or `openobserve`.

Left alone: the `db`, `mailserver` and `openobserve` services, and every named
volume (`pgdata`, `media`, `trail_imports`, `observatory`, `maildata`,
`mailstate`, `maillogs`, `caddy_data`, `caddy_config`). Recreating the five app containers does not disturb uploads,
mailboxes or issued certificates, and Keycloak's realm — including its SMTP
settings — survives because it lives in the untouched database.

The tradeoff is deliberate: **`postgis`, `docker-mailserver` and `openobserve`
version bumps in `docker-compose.yml` are not applied by CI.** All three are
upstream images holding live state, so they stay manual — deploy the compose
change, then on the host:

```bash
cd /opt/stigvidd && docker compose up -d db
cd /opt/stigvidd && docker compose up -d mailserver
cd /opt/stigvidd && docker compose up -d openobserve
```

Any change to the `mailserver`, `openobserve` **or `db`** service blocks needs its
command too; a normal CI deploy will not pick it up. This is the whole reason the
published 5432 needs a one-time manual step: the deploy **does** `scp` the new
`docker-compose.yml`, so the `ports:` and `command:` lines are permanent in the
file and every later deploy keeps them — but the *running* `db` container is only
replaced by that first `docker compose up -d db`. Until then `docker compose ps db`
shows no published port and the compose file and reality disagree, silently. After
the first deploy that carries a `db` change, check:

```bash
cd /opt/stigvidd && docker compose ps db     # published port present?
```

Note the asymmetry for observability, which is genuinely non-obvious: the
**Caddyfile is baked into the proxy image**, and `proxy` *is* in the deploy set —
so a CI deploy *does* ship the `observatory.<domain>` site block and Caddy *will*
obtain the certificate, but nothing is started behind it. On the deploy that
introduces the service, expect 502s on that subdomain until you run the third
command above.

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
`pgdata` (app **and** Keycloak databases), `media`, `maildata`, `mailstate` and
`trail_imports` volumes — the list `scripts/migrate.sh` actually carries. Adding
a named volume to `docker-compose.yml` is therefore also a change to that script
and to this list; see `docs/notes/compose-volume-needs-migrate-sh.md`.

On the **source** (in the compose dir):

```bash
./scripts/migrate.sh backup stigvidd-data.tar.gz     # stops the stack, snapshots volumes
scp stigvidd-data.tar.gz .env docker-compose.yml  target:/opt/stigvidd/
scp -r db db-certs mail-config                     target:/opt/stigvidd/
docker compose up -d                                 # bring source back up (or leave down for cutover)
```

> `mail-config/` and `db-certs/` are bind mounts, not volumes, so `migrate.sh`
> does **not** carry either — copy them explicitly as above. `mail-config/` holds
> the mail accounts and the DKIM private key; lose it and you must recreate every
> mailbox and republish the DKIM TXT record. `db-certs/` holds the Postgres server
> certificate: without it `db` will not start on the target at all, though
> regenerating it there with `./scripts/db-cert.sh <domain>` is equally valid
> since it is self-signed. Either way, re-run the `chown 0:999` on the key —
> `scp` does not preserve it.
>
> Note that a **CI deploy** copies only `docker-compose.yml` and `db/init/*.sql`,
> so `db-certs/` never travels that way, by design — a private key has no business
> in the pipeline.

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
5. **Recreate the observability config** on the target — the `observatory`
   volume is not carried by `migrate.sh`, so the ingest accounts, RUM application and
   metrics retention override need Part 1 step 8 again. The apps' RUM endpoint
   follows the domain name, so no app rebuild is needed as long as
   `observatory.stigvidd.se` moves with everything else. **Telemetry history does
   not survive the move** — if any of it matters, query and export it from the
   source before decommissioning.
6. **Verify** on the target (see below).
7. **Switch DNS** — point all six subdomains at the new host. Caddy issues fresh
   certs automatically within seconds (production `ACME_CA`). Also update the
   `_hostup.stigvidd.se` TXT record to the **new** host's IP, and ask Hostup to
   set rDNS for it — until both are done, outbound mail is refused by the relay.
   The MX record needs no change if `mail.stigvidd.se` moved with the rest.
8. Decommission the old host once the new one is confirmed healthy.

### Post-migration verification

```bash
docker compose ps                                   # all Up
docker compose exec db psql -U stigvidd -d stigvidd -c "SELECT count(*) FROM trails;"
docker compose exec db psql -U stigvidd -d keycloak -tAc "SELECT count(*) FROM user_entity;"
# The published 5432 needs the cert in place and a manual recreate — see
# "Direct database access". From OUTSIDE the host:
#   psql "postgresql://stigvidd_ro@stigvidd.se:5432/stigvidd?sslmode=require" -c 'select 1'
docker compose exec db psql -U stigvidd -tAc 'show ssl'      # -> on
curl -I https://media.stigvidd.se/<some/known/image/path>   # 200
curl -s https://observatory.stigvidd.se/healthz            # {"status":"ok"}
# sign in to the web admin and confirm content + that login (Keycloak) works

# Mail: TLS presents the right cert, and outbound reaches the relay.
openssl s_client -connect mail.stigvidd.se:587 -starttls smtp \
  -servername mail.stigvidd.se </dev/null 2>&1 | grep -E 'subject=|Verify return'

# Send as Keycloak does: authenticated, on 587. Port 25 will NOT work for this —
# PERMIT_DOCKER=none leaves `mynetworks` empty, so unauthenticated relay to an
# external domain is refused with "554 5.7.1 Relay access denied". That is the
# intended posture, not a misconfiguration. Omit --auth-password to be prompted
# rather than putting the secret in shell history.
docker compose exec -it mailserver swaks \
  --to <your-external-address> --from no-reply@stigvidd.se \
  --server mail.stigvidd.se:587 --auth-user no-reply@stigvidd.se --tls
docker compose logs mailserver | grep -E 'relay=|status='   # expect status=sent
```

Then send a mail *to* `info@stigvidd.se` from an outside account and check
`docker compose exec mailserver setup debug show-mail-logs` for
`status=sent (delivered to maildir)`. Finally, trigger the real path — the
**Forgot password** flow in the web admin — and confirm the message arrives;
the API returns 204 either way, so the mail log is the only evidence.

---

## Troubleshooting

**`db` won't start / restart-loops after a compose change.**
`ssl=on` makes Postgres refuse to start when the certificate is unusable, and
`restart: unless-stopped` then loops it. `docker compose logs db | tail -5` names
which of the two it is — both were measured on `postgis/postgis:17-3.5`:

| log line | fix |
|----------|-----|
| `FATAL: could not load server certificate file ".../server.crt": No such file or directory` | `./scripts/db-cert.sh <domain>` — `db-certs/` is empty (a fresh host, or a `scp` that skipped it). If compose created the directory first it is root-owned and the script cannot write to it: `sudo chown $USER db-certs`. |
| `FATAL: private key file ".../server.key" has group or world access` | `sudo chown 0:999 db-certs/server.key && sudo chmod 640 db-certs/server.key` |
| `could not load private key file ...: Permission denied` | same — the key is `0640` but owned by neither root nor uid 999, so the server cannot read it at all |

**5432 is open but connections are refused / time out.**
Check `docker compose ps db` first: if no published port is listed, the running
container predates the compose change and needs `docker compose up -d db` — CI
never recreates `db` (Part 3). If the port *is* published and connections still
fail, confirm `db` is attached to **`dbedge`** as well as `internal`: a container
whose only network is `internal: true` binds the host port and then has the
forwarded packet dropped by Docker's own isolation rules, which looks exactly
like a firewall problem and is not one. Note also that Docker's DNAT rules sit
ahead of `ufw`'s INPUT chain, so a host firewall is **not** what is blocking a
published port — and equally, `ufw deny 5432` will not close it.

**Connections work but every password is rejected.**
Network connections match `host all all all scram-sha-256`, so the password must
be right; the `trust` lines in `pg_hba.conf` apply to `127.0.0.1` *inside the
container* only, which is why `docker compose exec db psql` needs no password
while pgAdmin does. `docker compose logs db | grep -i 'authentication failed'`
shows the attempts — including the ones that are not you.

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

### Observability

**`observatory.<domain>` returns 502.**
Caddy has the certificate but nothing is listening behind it — almost always
because CI shipped the proxy without the container being started (Part 3).
`docker compose ps openobserve`, then `docker compose up -d openobserve`.

**`openobserve` never reaches `healthy`.**
It has no healthcheck, on purpose: the image is distroless, so there is no shell,
curl or wget inside it to probe with, and a `CMD-SHELL` check would just report it
permanently unhealthy. Probe from outside:
`curl -fsS https://observatory.<domain>/healthz`.

**The container exits immediately on first boot.**
Check `docker compose logs openobserve` for `ZO_ROOT_USER_PASSWORD is too weak`.
OpenObserve enforces 8-128 characters with at least one lowercase, one uppercase,
one digit and one special character, and *panics* rather than warning. Fix
`OBSERVATORY_ROOT_PASSWORD` in `.env`. Note the root account is only created while
the data volume is empty — if the volume already exists, changing the variable
does nothing and you must rotate in the UI instead.

**401 on ingest.**
The org in the URL path must exist (`default` unless you made another), and the
credential must be the *ingestion token* of the matching account from step 8 — not
a login password, and not a stale token from before the volume was recreated or the
passcode was reset.

Two traps specific to the token. It is **already base64**, so encoding it a second
time yields a 401 indistinguishable from a wrong credential — paste it verbatim.
And a passcode is valid **only on ingest routes**: a 401 from `/_search` or
`/streams` while ingest works is the token behaving correctly, not a broken one.

**Telemetry is accepted but does not appear where expected.**
Logs are routed to a stream by the `stream-name` header; without it they land in
`default`. Note the API's OTLP endpoint takes **no signal path** — the exporter
appends `/v1/logs` itself.

**Data from phones is silently dropped.**
`ZO_INGEST_ALLOWED_UPTO` rejects events older than its window (48h here, upstream
default 5h) and `ZO_INGEST_ALLOWED_IN_FUTURE` rejects events more than 24h ahead.
A handset with a badly wrong clock, or one that buffered for longer than the
window, hits one of these. `docker compose logs openobserve` names the rejected
timestamps.

**A metric only has 7 days of history.**
Its stream was created after `scripts/observatory-retention.sh` last ran, so it
inherited the 7-day global default instead of the 730-day metrics override. Re-run
the script. The already-expired data is gone — this is the accepted failure
direction, chosen so an unclassified stream errs towards a small disk rather than
a full one.

**The `observatory` volume is growing.**
Check which signal first:

```bash
docker system df -v | grep observatory
```

If logs or traces, lower `OBSERVATORY_RETENTION_DAYS` and
`docker compose up -d openobserve`. If metrics, the cause is almost always
**series cardinality**, not the two-year window — find the metric carrying a
high-cardinality attribute and drop or bucket it at the instrumentation site.
Compaction reclaims space on its next cycle, not instantly.

**Telemetry is missing after a host move.**
Expected: `observatory` is not in `migrate.sh`'s volume list. Redo Part 1 step 8
to recreate the ingest accounts, RUM application and retention override.

**Container log files are growing, or hold entries older than 7 days.**
Two separate causes, and the first hides the second.

```bash
docker inspect --format '{{.HostConfig.LogConfig}}' $(docker compose ps -q api)
systemctl list-timers stigvidd-log-retention.timer
```

If `LogConfig` shows no `max-size`, that container predates the `x-logging` anchor
— log options are fixed at *create* time, so `docker compose up -d` (which
recreates it) is the fix, not `restart`. If the timer is not listed or shows no
next run, Part 1 step 9 was never done on this host, and **nothing has ever
deleted a log line here** — the size caps bound disk, not age. Run it once by hand
(`sudo ./scripts/container-log-retention.sh --dry-run` first) and install the timer.

Note this is a compliance failure, not just a disk one: the published privacy
policy states a 7-day window for server logs, and `db` records the source IP of
every connection attempt on the public 5432.

### Mail

**`failed to bind host port 0.0.0.0:25/tcp: address already in use`.**
Most VPS images ship a system MTA (Postfix or Exim) enabled, and it holds port
25 — even when it only listens on loopback, because the container asks for
`0.0.0.0:25`, which includes `127.0.0.1`. Identify and remove it:

```bash
sudo ss -lptn 'sport = :25'        # or: sudo lsof -i :25
sudo systemctl disable --now postfix   # or exim4
docker compose up -d --no-deps mailserver
```

Use `disable`, not just `stop` — otherwise it returns at the next reboot and the
mail server fails to start then instead. If the host MTA is genuinely needed,
bind the container to the public IP only (`"<host-ip>:25:25"`) instead, at the
cost of hardcoding the IP and running two MTAs.

**Restarting `mailserver` restarts half the stack.**
`mailserver` depends on `proxy`, which depends on `web`/`api`/`media`, which
depend on `db` — so a bare `docker compose up -d mailserver` walks the whole
chain. (`proxy` deliberately does **not** depend on `keycloak`: Caddy resolves an
upstream lazily, and the dependency would force a partial stack to start a
Keycloak it borrows from elsewhere — see [STAGING.md](STAGING.md).) Pass
`--no-deps` for mail-only work:

```bash
docker compose up -d --no-deps mailserver
```

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

**`554 5.7.1 <addr>: Relay access denied` when testing.**
Working as designed, not a fault: `PERMIT_DOCKER=none` leaves Postfix's
`mynetworks` empty, so nothing may relay to an external domain without
authenticating — not even a connection from inside the container. Port 25
accepts mail only *for* our own domains; sending *through* the server requires
TLS + auth on 587 or 465, which is exactly what Keycloak does. Test that path
instead (see the Part 5 verification block), not `swaks --server localhost`.

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
