# Moving the admin off the apex touches four couplings, and only two are in this repo

`stigvidd.se` used to serve `web/` — the admin — so a visitor who typed the domain got a
login form. The public site is now its own project, `site/`, and the split is by
**hostname**, not by folder: `site` answers `${SITE_DOMAIN}` (the apex) and `web` answers
`${WEB_DOMAIN}` (`admin.stigvidd.se`).

Splitting the projects is the easy half. The hostname move is the half that breaks things,
and three of the four couplings fail at runtime with nothing red beforehand.

## 1. The API's CORS origin list — in the repo, tested by nothing

`backend/StigviddAPI/Program.cs` names the allowed browser origins literally:

```csharp
policy.WithOrigins("https://stigvidd.se", "https://admin.stigvidd.se", "https://api.stigvidd.se")
```

**No test covers this list.** `StigViddWebApplicationFactory` boots as `Development`, and
the Development branch of that policy is `SetIsOriginAllowed(_ => true)` — it reflects any
origin. So the production branch is exercised by no test on any machine, and a missing
entry is green everywhere and a blocked request in production only. Add the admin's new
origin here in the same change that moves it, or the admin loads and then fails every API
call from the browser.

## 2. Keycloak's **Web Origins** — NOT in the repo, and not the setting you expect

`keycloak/` holds a `Dockerfile` and nothing else: there is no realm export, so the
`stigvidd-admin` client's settings live only inside the running Keycloak. Moving the
admin's hostname means editing them in the admin console, by hand, on each environment.
Nothing in a diff, a test or a deploy will mention it.

**It is Web Origins, not Redirect URIs.** The admin does not use a redirect flow at all:
`web/src/services/keycloak-auth.ts` logs in with the **Direct Access Grant** — a `fetch`
POST of username and password to `{realm}/protocol/openid-connect/token` — and logs out
with a POST to the logout endpoint. There is no browser redirect anywhere, so redirect
URIs are irrelevant to it and changing them fixes nothing.

What does bite is CORS: that POST is cross-origin, from the admin's own origin to
`${AUTH_DOMAIN}`, and Keycloak only returns the `Access-Control-Allow-Origin` header for
origins listed in the client's **Web Origins**. Miss it and the browser blocks the token
request — the symptom is a **CORS error in the console and a login that never completes**,
not `invalid_redirect_uri`.

Watch for the literal value `+` in Web Origins: it means "whatever the redirect URIs say",
and with a direct-grant client that has no meaningful redirect URIs it allows nothing. `*`
allows everything and needs no edit.

## 3. The legal-page URLs are compiled into the app

`app/src/constants/constants.ts` hardcodes `https://stigvidd.se/privacy-policy/`,
`/terms-of-use/` and `/delete-account/` as absolute URLs. They are files under
`site/public/`, so whichever image answers the apex must be the one built from `site/` —
that is *why* the site takes the apex and the admin moves, rather than the other way
round. See [[web-public-is-already-live]].

The app can be corrected without a store release (the constants are JS, so an
`eas update` reaches installed builds), but the web side cannot: a wrong apex means the
privacy policy 404s for everyone at once.

## 4. Two Caddyfiles, and an empty variable takes everything down

`proxy/Caddyfile` and `proxy/Caddyfile.app` both need the new site block, and **nothing
checks that they agree** — `Caddyfile.app` is the partial-stack variant (STAGING.md).
`SITE_DOMAIN` is declared `${SITE_DOMAIN:?...}` in `docker-compose.yml` for the same
reason `OBSERVATORY_DOMAIN` is: a Caddy site block whose address interpolates to EMPTY
makes Caddy refuse its whole config, taking every other domain down with it. Failing at
interpolation time is much better than that.

A partial stack that runs the proxy must therefore also run `site`, or the apex answers
502. See [[proxy-aliases-shadow-public-hostnames]].

Both files also carry `www.{$SITE_DOMAIN}`, a redirect to the apex. It is a site address
of its own and takes its own certificate, so on any stack where the `www` record is
missing that block alone fails ACME — the others keep working.

## The order that works

DNS for the admin's new name first (Caddy cannot get a certificate for a name that does
not resolve), then Keycloak's Web Origins, then deploy. Doing it the other way round
locks you out of the admin until Keycloak is edited — which needs the Keycloak admin
console, not the Stigvidd admin, so it is recoverable, just unpleasant.
