<!--
SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# A password reset does not end existing sessions, and the SDK gives you no way to make it

`PasswordResetService.ResetAsync` changes the password in Keycloak and spends the link. It does
**not** revoke anything, so a session that was already signed in stays signed in. Against the
threat that usually motivates a reset — somebody else has the account — the reset alone is
therefore only half a fix, and it is worth knowing that before promising a user otherwise.

This is a **known limitation, not an oversight**, and it is recorded here rather than fixed
because fixing it properly is a larger change than the reset itself.

## Why it matters more here than in most products

[docs/auth.md](../auth.md): the app requests `scope=... offline_access` and stores an **offline**
refresh token in SecureStore. Its lifetime is governed by the realm's Offline Session settings,
deliberately long, and specifically *not* bound to the SSO session — that is the whole reason
the scope is requested. So the stale session does not quietly time out the way an online one
would.

## What the Admin API offers, and what the SDK actually exposes

`IKeycloakUserClient` in **Keycloak.AuthServices.Sdk 3.0.0** has exactly these members —
checked against the shipped assembly, not the documentation:

```
CreateUser  DeleteUser  DeleteCredential  ExecuteActionsEmail  GetCredentials
GetUser  GetUsers  GetUserCount  GetUserGroups  JoinGroup  LeaveGroup
ResetPassword  SendVerifyEmail  UpdateUser          (each with a *WithResponseAsync twin)
```

There is **no logout, no session and no consent member, and no generic "send this request"
seam** anywhere in the package. `IKeycloakRealmClient` has only `GetRealmAsync`. So none of the
three things that would work is reachable:

| what it would take | what it revokes |
| --- | --- |
| `POST /admin/realms/{realm}/users/{id}/logout` | regular SSO sessions — **not** offline sessions, which is the kind the app holds |
| `DELETE /admin/realms/{realm}/users/{id}/consents/{clientId}` | offline tokens for that client — but `stigvidd-app` is a public client that likely has no consent object to delete |
| `GET clients?clientId=` → `GET users/{id}/offline-sessions/{uuid}` → `DELETE sessions/{id}?isOffline=true` | everything, at the cost of three calls and a client lookup |

`POST /admin/realms/{realm}/push-revocation` is realm-wide `not-before`. It is the wrong tool:
it signs everybody out.

## If you implement it, two things will bite

1. **It needs a hand-rolled `HttpClient`.** Register a named client beside
   [`Program.cs`](../../backend/StigviddAPI/Program.cs)'s `AddKeycloakAdminHttpClient` block,
   same base address from `KeycloakAdminClientOptions`, with
   `.AddClientCredentialsTokenHandler(ClientCredentialsClientName.Parse("KeycloakAdminTokenClient"))`.
2. **The service account's roles cannot be checked from this repository** — the realm is not in
   the tree ([[verification-gate-lives-in-keycloak-not-the-api]], DEPLOYMENT.md §5).
   `manage-users` covers the logout and session calls; the `clients?clientId=` lookup needs
   `view-clients` or `query-clients`, which `stigvidd-admin-api` may not have. Expect a 403 you
   could not have predicted from here, so the call must be **best-effort and logged, never fatal
   to the reset** — a reset that fails because revocation failed is strictly worse than one that
   succeeds without it.

**Whatever gets shipped, write down what it does and does not revoke.** Shipping only
`/users/{id}/logout` and calling it "sessions revoked" is worse than shipping nothing, because
the next person reads the call and believes the offline token died with it. It did not.

Related: [[verification-gate-lives-in-keycloak-not-the-api]], and `docs/auth.md` for the token
model this rests on.
