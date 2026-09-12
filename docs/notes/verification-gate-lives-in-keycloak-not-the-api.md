# The email-verification gate is one Keycloak flag, because the app's login never passes through this API

`AccountController.Register` provisions the user, writes the `User` row and sends the mail — so
the intuitive place to refuse an unverified sign-in is the backend. **There is no such place.**

[docs/auth.md](../auth.md) explains the flow the decision falls out of: the app performs the
Keycloak **Direct Access Grant directly against Keycloak's token endpoint**
([`app/src/services/keycloak-auth.ts`](../../app/src/services/keycloak-auth.ts)), with no OIDC
library and no round trip through StigVidd. A login never reaches a controller, an
`[Authorize]` attribute or a middleware of ours. A check anywhere in `backend/` would guard an
endpoint nobody calls on the way in.

So the enforcement is two lines in
[`KeycloakAdminRepository.CreateUserAsync`](../../backend/Core/Repositories/KeycloakAdminRepository.cs):

```csharp
Enabled = false,
EmailVerified = false,
```

and `ActivateVerifiedUserAsync` setting both back to `true` once the link or code is used.
Keycloak rejecting a disabled user is the entire gate. Everything else in the feature — the
token table, the mail, the two endpoints, the screen — is machinery for flipping that flag.

`User.EmailVerifiedAt` is **not** a second gate. It is the operator-visible record, written in
the same save as the token's `ConsumedAt` so the two cannot drift.

## Why Keycloak's own VERIFY_EMAIL was not used

`SendPasswordResetEmailAsync` already calls `ExecuteActionsEmailAsync(["UPDATE_PASSWORD"])`, so
`["VERIFY_EMAIL"]` looks like one line of reuse. It was rejected for two measured reasons:

- the requirement is that the link be processed at a **StigVidd** endpoint, which Keycloak's own
  mail does not do; and
- **the realm is not in this repository.** There is no realm export anywhere in the tree — it is
  created by hand on the host ([DEPLOYMENT.md](../../DEPLOYMENT.md) §5), and its SMTP settings
  live in Keycloak's own database. Relying on `verifyEmail` would mean depending on a setting
  no test, no CI job and no file in this repo can see. Compare
  [[keycloak-realm-lives-in-appsettings-not-compose]], where one realm value being split across
  two sources produced a runtime 401 far from its cause.

## The symptom this produces, which looks like something else entirely

Keycloak answers a disabled account with **HTTP 400 `invalid_grant`** — byte for byte the same
status and error code as a wrong password. They differ only in `error_description`
(`"Account disabled"` vs `"Invalid user credentials"`), which `requestToken` did not read.

Left alone, that tells a user with the correct password that their password is wrong, with no
route forward. `AccountNotVerifiedError` reads the body to separate them, and **extends
`InvalidCredentialsError` on purpose**: `refreshGrant` ends the session on
`instanceof InvalidCredentialsError`, and an account disabled mid-session should end that
session exactly like a dead refresh token. The cost of that inheritance is an ordering trap —
a screen testing the broader class first silently swallows the narrower one, and every test
still passes. Measured: reordering the two `instanceof` checks in `login-screen.tsx` passed the
whole suite until a test was written specifically for it.

## A GET verification link is followed by machines before the human

Outlook Safe Links and similar scanners fetch every URL in a mail on delivery. A single-use
token that simply dies on first use is therefore already dead when its owner clicks it.
`EmailVerificationOutcome.AlreadyVerified` is treated as **success**, not an error, for exactly
this: a consumed token whose user is verified renders the confirmation page. A consumed token
whose user is *not* verified is a retired row (the user asked for a new mail) and stays invalid.

Related: [[in-memory-queue-in-front-of-a-database-journal]] for the outbox this rides on, and
`docs/auth.md` for the whole flow.
