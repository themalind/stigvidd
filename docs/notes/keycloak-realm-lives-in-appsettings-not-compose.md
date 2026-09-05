# The Keycloak realm came from appsettings.json, not compose — and one `Keycloak:realm` feeds both authentication and the admin client

[`backend/StigviddAPI/appsettings.json`](../../backend/StigviddAPI/appsettings.json) pins the
realm in two sections:

```json
"Keycloak":            { "realm": "stigvidd", "resource": "stigvidd-api" },
"KeycloakAdminClient": { "realm": "stigvidd", "resource": "stigvidd-admin-api" }
```

and [`docker-compose.yml`](../../docker-compose.yml) overrode only the **URL**
(`Keycloak__auth-server-url`, `KeycloakAdminClient__auth-server-url`) and the admin client
secret. So until this was added, the realm was the one piece of Keycloak configuration that
could not be changed without editing a committed file — which is what blocked a second
environment pointing at the same Keycloak and its own realm.

`docker-compose.yml` now sets, defaulted so an `.env` that never mentions it is unchanged:

```yaml
Keycloak__realm: ${KEYCLOAK_REALM:-stigvidd}
KeycloakAdminClient__realm: ${KEYCLOAK_REALM:-stigvidd}
```

## The part that is not obvious

**Both lines are needed, and they are not symmetric.** There are two consumers and they read
from *different* places than their names suggest:

| consumer | reads |
| --- | --- |
| [`Program.cs:70`](../../backend/StigviddAPI/Program.cs#L70) `AddKeycloakWebApiAuthentication(builder.Configuration)` | binds the whole **`Keycloak`** section — this is what validates incoming tokens |
| [`KeycloakAdminRepository.cs:26`](../../backend/Core/Repositories/KeycloakAdminRepository.cs#L26) | `configuration["Keycloak:realm"]` — the **`Keycloak`** section too, *not* `KeycloakAdminClient`'s, despite being the admin client |
| `Program.cs:91` `GetKeycloakOptions<KeycloakAdminClientOptions>("KeycloakAdminClient")` | the `KeycloakAdminClient` section, for the token endpoint |

So the admin repository builds its realm-scoped Admin API URLs from `Keycloak:realm` while
minting its token against `KeycloakAdminClient`. Set only one of the two and the two halves
disagree: tokens validate against one realm while user provisioning, registration and
forgot-password hit another. Nothing fails at startup — the failure is a runtime 404 or 401
from the Admin API, far from the configuration that caused it.

## Symptom to recognise

Sign-in through the SPA succeeds and every `[Authorize]` call returns **401**. That is the
SPA and the API disagreeing about the realm, and on the web side the realm is
`VITE_OIDC_REALM` — a Vite **build argument**, baked into the bundle. So the two drift
whenever the API's env changes and the web image is not rebuilt. Check both:

```sh
docker compose exec api env | grep -i realm
```

Related: [[proxy-aliases-shadow-public-hostnames]], [[integration-tests-inherit-api-config]].
