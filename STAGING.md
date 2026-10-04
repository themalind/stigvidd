# Setting up the Stigvidd staging environment

A step-by-step runbook for standing up staging on its own host.
[DEPLOYMENT.md](DEPLOYMENT.md) is the production runbook and the reference for anything
this document does not repeat; read that first if you have never deployed this stack.

**Contents**

1. [What staging is, and what it is not](#1-what-staging-is-and-what-it-is-not)
2. [Domains](#2-domains)
3. [Prerequisites](#3-prerequisites)
4. [Step 1 — Production-side setup](#step-1--production-side-setup)
5. [Step 2 — Host prep](#step-2--host-prep)
6. [Step 3 — The staging `.env`](#step-3--the-staging-env)
7. [Step 4 — Get the staging images and start](#step-4--get-the-staging-images-and-start)
8. [Step 5 — Verify](#step-5--verify)
9. [Step 6 — Container log retention timer](#step-6--container-log-retention-timer)
10. [Refreshing staging from production data](#refreshing-staging-from-production-data)
11. [Continuous deployment (branch `staging`)](#continuous-deployment-branch-staging)
12. [Troubleshooting](#troubleshooting)

---

## 1. What staging is, and what it is not

Staging is a **partial stack**. It runs six of the nine services on its own host and
borrows the other three from production:

| service | where | note |
| --- | --- | --- |
| `db` | **staging host** | its own PostGIS, its own `pgdata`. No production data unless you put it there. |
| `api` | **staging host** | built from the same source, its own image tag |
| `site` | **staging host** | the public site. Static, no build args, so any tag works |
| `web` | **staging host** | needs its **own image** — see the warning below |
| `media` | **staging host** | its own uploads, its own `media` volume |
| `proxy` | **staging host** | Caddy, running the **slim** `Caddyfile.app` |
| `keycloak` | *production* | same server, a **different realm** (`stigvidd-staging`) |
| `mailserver` | *production* | staging sends no mail itself; Keycloak's staging realm does |
| `openobserve` | *production* | same server, a **different organization** |

That is a deliberate trade: three fewer services to operate, at the cost of three shared
dependencies. What it means in practice:

- **If production is down, staging's sign-in is down.** Auth, mail and telemetry all leave
  the staging host.
- **Changing production's Keycloak version or upgrading the mail server affects staging
  too.** Staging is no longer a safe place to rehearse those two upgrades specifically.
- **Staging writes into production's OpenObserve instance.** A separate *organization* is
  a namespace, not a security boundary — OpenObserve OSS has **no RBAC** at all, and every
  account has unrestricted access to every organization
  ([docs/notes/openobserve-oss-has-no-rbac.md](docs/notes/openobserve-oss-has-no-rbac.md)).
  Treat a staging ingest token as production-grade, and never ship a login password.
- **Staging's `db` never holds a `keycloak` database.** `db/init/02-keycloak-db.sql` still
  creates an empty one; nothing uses it. The admin export from staging simply contains no
  `keycloak.dump` — [`DataTransferService`](backend/Core/Services/DataTransferService.cs)
  skips it best-effort, so export/import still works.

> ### The web image cannot be shared with production
>
> `VITE_API_URL`, `VITE_OIDC_URL`, `VITE_OIDC_REALM`, `VITE_CLIENT_ID`, `VITE_OO_LOGS_URL`
> and `VITE_OO_LOGS_TOKEN` are **build arguments**. Vite inlines them into the bundle at
> build time, so they are frozen into the image. Staging therefore needs its **own
> `stigvidd-web` image**, and any change to those six values requires a **rebuild**, not a
> restart. This is the single most common way a staging config change appears to do
> nothing.
>
> The other four images (`api`, `media`, `proxy`, `keycloak`) carry no environment and can
> be shared with production at the same tag.

---

## 2. Domains

Staging serves **three** names, all pointing at the staging host:

| domain | service |
| --- | --- |
| `staging.stigvidd.se` | `web` |
| `staging.api.stigvidd.se` | `api` |
| `staging.media.stigvidd.se` | `media` |

and consumes three production names, which point at the **production** host and need no new
DNS:

| domain | used as |
| --- | --- |
| `auth.stigvidd.se` | `KEYCLOAK_URL` — the staging realm's issuer |
| `observatory.stigvidd.se` | `OTLP_ENDPOINT` and `VITE_OO_LOGS_URL` |
| `mail.stigvidd.se` | Keycloak's staging-realm SMTP host |

> **`AUTH_DOMAIN`, `OBSERVATORY_DOMAIN` and `MAIL_DOMAIN` must still be set, and must be
> STAGING names — never production's.**
>
> Two separate mechanisms make this load-bearing:
>
> 1. Compose interpolates the **whole** `docker-compose.yml` before it selects services, so
>    every `${VAR:?}` in the file is required even for services you never start. Measured:
>    with `KC_ADMIN_USER` absent, `docker compose config` fails with
>    `required variable KC_ADMIN_USER is missing a value`, although `KC_ADMIN_USER` appears
>    only inside the `keycloak` service.
> 2. The `proxy` service publishes every `*_DOMAIN` as a **network alias** on the `public`
>    network — deliberately, so a whole-stack host resolves its own public names internally
>    instead of hairpinning out. On a partial stack that becomes a hijack: set
>    `AUTH_DOMAIN=auth.stigvidd.se` and the *staging* Caddy claims production's hostname
>    inside the staging stack, and the API's calls to the real Keycloak are answered by a
>    `keycloak:8080` that does not exist.
>
> So set them to `staging.auth.stigvidd.se`, `staging.observatory.stigvidd.se` and
> `staging.mail.stigvidd.se`. Those names need **no DNS record** — they are docker-internal
> aliases for services this stack does not run, and `Caddyfile.app` does not serve them.

---

## 3. Prerequisites

- A host with Docker Engine and Compose v2, and pull access to the `lingonberg.se` registry (the host the Jenkinsfile pushes to).
- **Three** DNS A records (§2), with ports 80 and 443 reachable from the internet so Caddy
  can complete an ACME challenge.
- **No** mail ports needed — staging runs no mail server. 25/465/587/993 stay closed.
- Roughly half the RAM of production: no `mailserver` (which alone wants 2 GB) and no
  `openobserve`.
- Access to the **production** Keycloak admin console and OpenObserve UI, for Step 1.

---

## Step 1 — Production-side setup

Done once, on the **production** host's services. Nothing here touches production's realm,
organization or data — you are adding a second one alongside.

### a. The staging realm in production Keycloak

At `https://auth.stigvidd.se`, create realm **`stigvidd-staging`** with the same three
clients production uses:

| client | type | purpose |
| --- | --- | --- |
| `stigvidd-api` | public | the API's audience; token `aud` is validated against it |
| `stigvidd-admin-api` | **confidential** | its Credentials-tab secret becomes `KEYCLOAK_ADMIN_CLIENT_SECRET` |
| `stigvidd-admin` | public | the admin web SPA; `VITE_CLIENT_ID` |

Then:

- Set `stigvidd-admin`'s **web origins** to the staging web domain
  (`https://staging.stigvidd.se`), not production's. **Web origins is the one that
  matters**: the admin logs in with the Direct Access Grant — a cross-origin `fetch` POST
  to the token endpoint — and never redirects, so redirect URIs change nothing and a
  missing web origin is a CORS error with a login that never completes. Setting the
  redirect URIs too is harmless, but do not expect them to fix a failing login.
- Create the realm role **`stigvidd-admin`** (the API's `Authorization:AdminRole`; the admin web requires it) and grant it to whoever needs the migration page.
- **Generate a new secret for `stigvidd-admin-api`.** Do not reuse production's.
- Configure **Realm settings → Email** for this realm if you want Keycloak's own admin-console
  mail to work: host `mail.stigvidd.se`, port 587, StartTLS, authenticating as
  `SMTP_NOREPLY_USER` / `SMTP_NOREPLY_PASSWORD`. Realm SMTP is per-realm config stored in the
  database — the staging realm does **not** inherit production's. **No user-facing flow needs
  it:** both `forgot-password` and email verification send through the API's own outbox
  (`Smtp__*`), not Keycloak.

The quickest route is to export the production realm, edit the realm name and redirect URIs,
and import it — that also carries the role and client layout. Regenerate every secret
afterwards.

### b. The staging organization in production OpenObserve

At `https://observatory.stigvidd.se`, create an organization for staging, then create the
ingest accounts *inside it* exactly as production's Step 8 does — `api@` and `web@` — and
copy each one's **ingestion token** from the Ingestion page.

Note the organization id: it appears **in the URL path** of the ingest endpoint, which is
what `VITE_OO_LOGS_URL` and `OTLP_ENDPOINT` need.

> Never put a **login password** in `VITE_OO_LOGS_TOKEN` or `OTLP_TOKEN`. On OSS a password
> reads every stream and can mint admins; a passcode is ingest-only. The two are the same
> shape, so nothing about the value tells you which you have — the test is whether
> `/_search` returns 401 with it.

---

## Step 2 — Host prep

```bash
sudo mkdir -p /opt/stigvidd-staging/{db/init,scripts}
sudo chown -R "$USER" /opt/stigvidd-staging
cd /opt/stigvidd-staging
```

Copy from a checkout of the repo:

```bash
scp docker-compose.yml docker-compose.staging.yml staging-host:/opt/stigvidd-staging/
scp .env.staging.example          staging-host:/opt/stigvidd-staging/.env
scp db/init/*.sql                 staging-host:/opt/stigvidd-staging/db/init/
scp scripts/*.sh                  staging-host:/opt/stigvidd-staging/scripts/
ssh staging-host 'chmod +x /opt/stigvidd-staging/scripts/*.sh'
```

Then, **before the first `up`**:

```bash
cd /opt/stigvidd-staging
./scripts/db-cert.sh staging.stigvidd.se   # writes ./db-certs/{server.crt,server.key}
mkdir -p mail-config                       # unused here, but the compose bind mount wants it
```

`db` starts with `-c ssl=on` and **refuses to start** if `./db-certs/` is missing. The
certificate is self-signed and carries no shared trust, so generating a fresh one per host
is correct — do not copy production's.

---

## Step 3 — The staging `.env`

[`.env.staging.example`](.env.staging.example) is the whole file, with placeholders only
(Step 2 already copied it to `.env`). Fill in every `<placeholder>`. The groups:

- **Compose files and images** — `COMPOSE_FILE` layers
  [`docker-compose.staging.yml`](docker-compose.staging.yml) on the base file: it pins the slim
  `Caddyfile.app` (so there is no `CADDYFILE` setting), sets `DataTransfer__SharedServices`
  and puts `keycloak`, `openobserve` and `mailserver` behind a `production-only` profile.
  `IMAGE_TAG=staging` follows CI; pin a `<sha>-staging` tag to hold a version.
- **Staging's own identity** — the four staging domains, database, WebDAV credentials.
- **The production services it borrows** — `KEYCLOAK_URL` (production host, `stigvidd-staging`
  realm) and `OTLP_*` (production host, staging organization).
- **Names this stack does not serve** — `AUTH_/OBSERVATORY_/MAIL_DOMAIN` must be staging
  names (§2).
- **Placeholders** that exist only because compose interpolates the whole file.

`ASPNETCORE_ENVIRONMENT=Production` is deliberate: `Development` would enable Swagger and
change the config precedence chain, which is not what you want to rehearse. Staging should
exercise the same code path production does.

---

## Step 4 — Get the staging images and start

Images come from CI: every build of the `staging` branch pushes
`<registry>/stigvidd-{api,web,site,media,proxy}:<sha12>-staging` and moves the `staging` tag
(see [Continuous deployment](#continuous-deployment-branch-staging)). The `web` image is built
there with the staging `VITE_*` values; no host-local override is needed. There is no
`keycloak` image: staging borrows production's.

On the staging host:

```bash
cd /opt/stigvidd-staging
docker login lingonberg.se        # the registry host the Jenkinsfile pushes to

# proxy first: it must be up before anything needs a certificate
docker compose up -d proxy
docker compose up -d db api web site media
```

`COMPOSE_FILE` from `.env` selects the override, so a bare `docker compose up -d` would also
only start the five staging services — but name them anyway on the first run.

**Fallback without CI**: build `web` by hand with the staging build args and a `-staging` tag,
push it, and set `IMAGE_TAG` accordingly:

```bash
docker build ./web \
  --build-arg VITE_API_URL=https://staging.api.stigvidd.se \
  --build-arg VITE_OIDC_URL=https://auth.stigvidd.se \
  --build-arg VITE_OIDC_REALM=stigvidd-staging \
  --build-arg VITE_CLIENT_ID=stigvidd-admin \
  -t "lingonberg.se/stigvidd-web:$(git rev-parse --short=12 HEAD)-staging"
```

(`VITE_OO_LOGS_*` are optional: unset, the bundle installs no log sink.) `VITE_OIDC_URL` is
**production's** auth host while `VITE_OIDC_REALM` is the staging realm.

---

## Step 5 — Verify

```bash
docker compose ps          # exactly five services, Up / healthy
curl -I https://staging.stigvidd.se
curl -I https://staging.api.stigvidd.se
curl -s  https://staging.api.stigvidd.se/healthz    # liveness
curl -s  https://staging.api.stigvidd.se/readyz     # readiness — this one checks the database
curl -I https://staging.media.stigvidd.se
```

`/readyz` is the one that matters after a first boot: it is the check that touches Postgres,
and it is what proves `db-certs/` and the connection string are right.

Then the four things that prove the *borrowed* services are wired correctly. Each fails in a
way the curls above will not catch:

1. **Sign in to the admin web** at `https://staging.stigvidd.se`. This exercises
   `KEYCLOAK_REALM` end to end — the SPA's `VITE_OIDC_REALM`, the API's token validation and
   `stigvidd-admin`'s redirect URIs must all agree on `stigvidd-staging`.
2. **Call an `[Authorize]` endpoint** with that token. A 401 here, after a successful
   sign-in, means the API is validating against a different realm than the SPA logged into
   — check `Keycloak__realm` in `docker compose exec api env`.
3. **Upload an image** through the admin web, and confirm the returned URL is on
   `staging.media.stigvidd.se` and resolves. That proves `WEBDAV_*` and
   `PRESENTABLE_BASE_URL`.
4. **Find a log line in the staging OpenObserve organization**, not production's. Search
   `stigvidd_api_logs` in the staging org. If the lines landed in production's org, the org
   id in `OTLP_ENDPOINT` is wrong.

Also confirm the hijack is not happening:

```bash
docker compose exec api getent hosts auth.stigvidd.se
```

This must return the **production host's public IP**. If it returns a stack-internal address
(`10.x`), `AUTH_DOMAIN` is set to a production name — see [Troubleshooting](#troubleshooting).

---

## Step 6 — Container log retention timer

Staging's `db` also runs with `log_connections=on` behind a published 5432, so it also
records a source IP per connection attempt. `json-file` has **no time-based retention**
([docs/notes/json-file-has-no-time-retention.md](docs/notes/json-file-has-no-time-retention.md)),
so the size caps in `docker-compose.yml` are only half the promise here too.

Install the same daily timer production uses, with the staging paths:

```bash
sudo tee /etc/systemd/system/stigvidd-staging-log-retention.service >/dev/null <<'UNIT'
[Unit]
Description=Age out Stigvidd staging container logs to the retention window
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=/opt/stigvidd-staging
ExecStart=/opt/stigvidd-staging/scripts/container-log-retention.sh
UNIT

sudo tee /etc/systemd/system/stigvidd-staging-log-retention.timer >/dev/null <<'UNIT'
[Unit]
Description=Daily Stigvidd staging container log retention

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now stigvidd-staging-log-retention.timer
systemctl list-timers stigvidd-staging-log-retention.timer
```

Whether the published 7-day policy legally binds a staging host depends on whether staging
holds real personal data — which is a decision you make in the next section, not a technical
one. Install the timer either way; it costs nothing.

---

## Refreshing staging from production data

> **Copying production data to staging is a GDPR decision before it is a technical one.**
> The processing record (`docs/registerforteckning.md`, gitignored and kept out of this
> public repository) describes production. A staging host holding real user data is a second copy of that
> personal data, on a host with different access, different retention and — as configured
> above — a published 5432. Prefer synthetic or anonymised data. If you do copy, the staging
> host inherits every obligation the production host has.

With that settled, two mechanisms exist, both documented in
[DEPLOYMENT.md Part 4](DEPLOYMENT.md#part-4--migrating-data):

- **Admin export/import** (the migration page in the admin web) — the recommended route.
  1. On **production**, tick **Anonymize personal data** and export. Users get placeholder
     names and addresses, push tokens, verification/reset codes and the mail log are
     removed, and Keycloak is left out; hikes, reviews and photos are kept. The
     anonymization happens on the production server, so the downloaded archive is the
     only copy that travels.
  2. On **staging**, sign in with the `stigvidd-admin` realm role of the staging realm and
     import it. Because staging runs with `DATA_TRANSFER_SHARED_SERVICES=true` (from
     `docker-compose.staging.yml`), the import never restores Keycloak — even from a full,
     non-anonymized archive — and always clears queued mail, push tokens and
     verification/reset codes, since staging sends mail through production's mail server.
  3. Restart the API (below). Staging must run the same or a newer version than production;
     an archive from newer code is refused before anything is touched.

  The restored users belong to production's realm. Staging validates tokens against
  `stigvidd-staging`, so nobody can sign in to staging as their production account; testers
  use staging-realm accounts, which get fresh user rows on first use.
- **`scripts/migrate.sh`** — volume-level copy of `pgdata`, `media`, `maildata`, `mailstate`
  and `trail_imports`. On staging only `pgdata`, `media` and `trail_imports` are meaningful;
  the two mail volumes have no service to belong to. This copies personal data **as is** and
  clears nothing; prefer the admin route.

After either, restart the API so EF migrations run against the restored database:

```bash
docker compose up -d --no-deps --force-recreate api
```

---

## Continuous deployment (branch `staging`)

The [Jenkinsfile](Jenkinsfile) is branch-aware: `main` is production, `staging` is staging, and
every other branch or PR stops after `Test`. A push to `staging` runs the same tests, then
builds and pushes `api web site media proxy` as `<sha12>-staging` plus a moving `staging` tag,
with the staging `VITE_*` values (`https://staging.api.stigvidd.se`, `auth.stigvidd.se`, realm
`stigvidd-staging`), and deploys them to `/opt/stigvidd-staging` with
`pull`/`up -d --no-deps` on those five services. Builds are serialized with `main` by a
`stigvidd-ci` lock. `db` is never touched by CI: bring it up once by hand (Step 4).

**One-time Jenkins setup** (details in the Jenkinsfile header):

1. Plugin: *Lockable Resources*.
2. Global environment variables (Manage Jenkins > System): `STAGING_DEPLOY_HOST`
   (e.g. `stigvidd@<staging host>`) and `STAGING_OO_LOGS_URL`
   (`https://observatory.stigvidd.se/api/<staging-org-id>/stigvidd_web_logs/_json`, optional).
3. Credential `staging-oo-logs-token` (secret text, the staging org's `web@` ingestion token;
   optional: without it the web image has no telemetry). The existing `deploy-ssh-key` and
   `registry-credentials` are reused; authorise the key on the staging host.
4. Seed the Jenkins user's `known_hosts` with the staging host (`ssh-keyscan -H`).
5. Create the branch and push it so the multibranch job discovers it:
   `git push origin develop:staging` (or any commit you want staged).

Until `STAGING_DEPLOY_HOST` is set, a `staging` build pushes the images and **skips the deploy**
(logging "staging host not configured"), staying green; Step 4 can then pull those tags by hand.

> Rotate `VITE_OO_LOGS_TOKEN` (production's). It is still a real production ingest credential
> committed in plaintext in the [Jenkinsfile](Jenkinsfile), and a git-committed credential
> cannot be rotated quietly. Move it into a Jenkins credential like staging's.

---

## Troubleshooting

**Sign-in succeeds but every API call is 401.**
The SPA and the API disagree about the realm. `VITE_OIDC_REALM` is baked into the web image
at build time while `Keycloak__realm` is read at container start, so they drift whenever the
web image is not rebuilt. Check both:

```bash
docker compose exec api env | grep -i realm       # Keycloak__realm
curl -s https://staging.stigvidd.se/assets/*.js | grep -o 'stigvidd-staging' | head -1
```

**Auth calls fail with a connection error or a 502, and the config looks correct.**
The hostname hijack from §2. `AUTH_DOMAIN` is set to `auth.stigvidd.se`, so the staging
proxy claimed production's name as a network alias and the API's request never left the
host. Confirm with `docker compose exec api getent hosts auth.stigvidd.se` — a `10.x`
answer is the tell. Fix `AUTH_DOMAIN` to `staging.auth.stigvidd.se` and
`docker compose up -d --force-recreate proxy`.

**`docker compose up` fails on a variable no staging service uses.**
Expected. Compose interpolates the whole file before selecting services, so
`KC_ADMIN_USER`, `KC_ADMIN_PASSWORD`, `OBSERVATORY_ROOT_EMAIL` and
`OBSERVATORY_ROOT_PASSWORD` must exist even though `keycloak` and `openobserve` never start.
Add the placeholders from Step 3.

**Caddy logs repeated ACME failures for `staging.auth...` / `staging.observatory...` /
`staging.mail...`.**
The staging override is not applied (`COMPOSE_FILE` missing from `.env`, or
`docker-compose.staging.yml` not on the host), so the proxy is running the full six-site
`Caddyfile` and trying to obtain certificates for three names with no DNS. Fix `COMPOSE_FILE`
and recreate the proxy. Repeated failed validations
also consume a Let's Encrypt rate limit, so fix it rather than waiting it out.

**A config change to the admin web appears to do nothing.**
The six `VITE_*` values are build args, not runtime env. Rebuild and push the web image
(Step 4). Restarting the container cannot change them.

**Log lines are appearing in production's OpenObserve organization.**
The org id is a path segment in `OTLP_ENDPOINT` (API) and `VITE_OO_LOGS_URL` (web). The web
one is baked into the image, so fixing `.env` alone does not fix the admin web — rebuild.

**`db` will not start.**
`./db-certs/` is missing or the key's ownership is wrong; `ssl=on` makes Postgres refuse to
start. Re-run `./scripts/db-cert.sh staging.stigvidd.se` from the compose directory.

**`docker compose ps` shows more than five services.**
Something ran a bare `docker compose up -d`. Stop the three that do not belong:

```bash
docker compose stop keycloak openobserve mailserver
docker compose rm -f keycloak openobserve mailserver
```

Their volumes remain but are inert.

---

## See also

- [DEPLOYMENT.md](DEPLOYMENT.md) — the production runbook; the reference for everything
  staging borrows
- [.env.example](.env.example) — every variable, annotated
- [docs/notes/openobserve-oss-has-no-rbac.md](docs/notes/openobserve-oss-has-no-rbac.md) —
  why an ingest token is the only credential that may be public
- [docs/notes/compose-volume-needs-migrate-sh.md](docs/notes/compose-volume-needs-migrate-sh.md) —
  adding a volume is also a change to `scripts/migrate.sh`
- [.claude/skills/verify-in-docker/SKILL.md](.claude/skills/verify-in-docker/SKILL.md) — no
  GitHub CI job builds an image or runs compose, so changes here must be run
