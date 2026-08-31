# OpenObserve OSS has no RBAC, so the ingestion token is the only thing a public credential may be

The `Member` role that [DEPLOYMENT.md](../../DEPLOYMENT.md) told you to give the ingest
account does not exist on the OSS image, and neither does any other restricted role.
Measured against `public.ecr.aws/zinclabs/openobserve:v0.92.2`, creating a user through
`POST /api/default/users` as root:

| requested role | result |
| --- | --- |
| `admin` | 200 |
| `service_account` | **200, then silently stored as `admin`** |
| `member`, `editor`, `viewer` | 400 `{"code":400,"message":"Custom roles not allowed"}` |
| `root` | 400 `{"code":400,"message":"Not allowed"}` |

Upstream is explicit once you find the right page: *"Open-source version: RBAC is not
supported. All users have unrestricted access to all features."* Service Accounts — the
obvious answer to "give each service its own scoped credential" — are Enterprise-only, and
the `service_account` value being accepted rather than rejected is the trap: nothing tells
you it became an admin.

## What IS enforced: password vs passcode

Every account has two secrets. The **login password**, and a per-user, per-organisation
**passcode** — the "ingestion token" that OpenObserve's *Ingestion* page prints, already
base64'd as `user:passcode`. `GET /api/{org}/passcode` returns it, and it is self-scoped:
you must be signed in **as that user**, because root cannot read someone else's.

Measured for one and the same account, `Authorization: Basic <base64>` either way:

| call | ingestion token | login password |
| --- | --- | --- |
| `POST /api/default/<stream>/_json` | 200 | 200 |
| `POST /api/default/v1/logs` (OTLP) | 400 — a *protobuf parse* error, so auth passed | — |
| `POST /api/default/_search` | **401** | **200**, returned the ingested records |
| `GET /api/default/users` | **401** | **200** |
| `POST /api/default/users` | — | **200**, created another admin |

The `v1/logs` row is the one to read carefully, because 400 looks like a failure: with no
auth header at all, and with a deliberately wrong token, the same call returns **401**. A
400 therefore means the credential was accepted and only the body was rejected — which is
how you confirm a passcode works for OTLP ingest without assembling a protobuf.

## Why this matters more than tidiness

A passcode is a genuine capability boundary; a password is not scoped at all. So on OSS:

> **Anything shipped to a client must carry an ingestion token. A login password in a
> public bundle is not a weak ingest credential — it is full control of the observatory,
> including read access to every stream of personal data and the ability to mint admins.**

Before this was measured, `app/src/services/telemetry.ts` documented its
`EXPO_PUBLIC_OO_LOGS_TOKEN` as `base64("<ingest-user>:<password>")` and shipped it in every
APK. Both forms are the same shape, so nothing about the value itself reveals which one is
in use — the only way to tell is to try `/_search` with it and see whether you get 401.

The same reasoning made the admin web's token viable at all: it is inlined by Vite into a
bundle served publicly, so it is readable with one `curl`, no APK needed.

## Where a passcode does NOT work

Only ingest routes accept it. `scripts/observatory-retention.sh` changes **stream
settings**, which answers 401 for a passcode, so it necessarily authenticates with a
password — and on OSS that password is unavoidably full admin. It uses `OBSERVATORY_OPS_*`
rather than root only because the root password is the first-boot `ZO_ROOT_USER_PASSWORD`
and cannot be changed by editing `.env` afterwards, so it is the one credential that cannot
be rotated at all.

## Reproducing it

The container in [README.md](../../README.md)'s *Telemetry* section is enough. Two
environment traps, both of which cost time here:

- On rootless podman the published port is IPv4-only, so `localhost:5080` fails with a
  connection refused while `127.0.0.1:5080` works — `localhost` resolves to `::1` first.
- `_search` wants **microsecond** `start_time`/`end_time`; a millisecond range comes back
  as `400 [file_list] invalid time range`, which reads like an auth or schema problem and
  is neither.

Related: [[web-vitest-environment]], [[eas-env-vars-are-not-your-dotenv]].
