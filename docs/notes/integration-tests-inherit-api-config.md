# The integration tests inherit StigviddAPI's appsettings.json *and your user secrets*, so a config deletion is green locally and 337 red on CI

`StigViddWebApplicationFactory` boots the real `StigviddAPI.Program.Main`. It substitutes the
database, WebDAV and `IKeycloakAdminRepository`, but it substitutes **no configuration at
all** — the host reads StigviddAPI's own providers, in `WebApplication.CreateBuilder`'s order:

```
appsettings.json  ->  appsettings.Development.json  ->  user secrets  ->  environment variables
```

Two consequences, and the second is the one that costs a day.

## 1. Deleting a value from `appsettings.json` kills the whole suite

Commit `ab97fb3` removed `auth-server-url` and `credentials.secret` from the `Keycloak` and
`KeycloakAdminClient` sections — correctly, they were live secrets in a public file. Jenkins
build 44 then failed **337 of 1441**, every one of them in its constructor with:

```
Microsoft.Extensions.Options.OptionsValidationException :
  Keycloak Admin HTTP client requires a valid absolute URI for 'AuthServerUrl'.
    at Microsoft.Extensions.Options.StartupValidator.Validate()
    at StigviddAPI.Program.Main(...) Program.cs:244
```

337 is the entire `IntegrationTests` project. `AddKeycloakAdminHttpClient(options)`
([Program.cs](../../backend/StigviddAPI/Program.cs)) validates on start, so nothing under
test ever runs. Same shape as [[dotnet-test-connection-string]], one line earlier in the same
file, and just as anonymous in the output: it names neither `appsettings.json` nor which
section.

## 2. User secrets are why it passed review

The factory calls `builder.UseEnvironment("Development")`, and `StigviddAPI.csproj` has a
`UserSecretsId` — so **the suite reads the developer's user secrets**. Any box with
`Keycloak` / `KeycloakAdminClient` in `~/.microsoft/usersecrets/<id>/secrets.json` is green
on the exact tree that fails on CI, and nothing says so. Measured here: stripping only those
two sections from that file turned 337 passing into 337 failing, with no code change.

**So a local green run is not evidence about a configuration change.** To get an honest
signal, move the sections out of `secrets.json` (back it up first) and re-run. `git stash`
does not help — the divergence is not in the tree.

## The fix, and why it is a module initializer

[`Tests/IntegrationTests/KeycloakConfigPreload.cs`](../../backend/Tests/IntegrationTests/KeycloakConfigPreload.cs)
sets the keys as **environment variables** from a `[ModuleInitializer]`, the same mechanism
[[magick-jpeg-collides-with-mod-spatialite]] uses for a different pre-host problem.

`builder.ConfigureAppConfiguration(...)` in `ConfigureWebHost` does **not** work, and fails in
the worst possible way — measured, it still fails 337/337, looking exactly like no fix at all.
`WebApplicationFactory` reaches a `Program.Main` through `DeferredHostBuilder`, whose
configuration callbacks run *after* the `builder.Configuration` reads inside `Program.Main`.

Environment variables were the right lever for a second reason: they rank **above** user
secrets, so they close divergence (2) as well as (1) — every box now behaves like Jenkins.

Mutation-proved, with user secrets suppressed, one key at a time:

| key | removing it |
| --- | --- |
| `KeycloakAdminClient__auth-server-url` | **337 failed** — reproduces build 44 exactly |
| `Keycloak__auth-server-url` | 0 failed — `TestAuthHandler` replaces the scheme, JwtBearer never resolves its metadata |
| `KeycloakAdminClient__credentials__secret` | 0 failed — Duende's `AddClient` callback is lazy and the admin repository is mocked |

The two inert keys are kept deliberately: `ClientSecret.Parse(null)` is what waits behind the
third, and its failure would look like this one all over again.

## The half nobody's tests can see

`docker-compose.yml` overrode only `auth-server-url`; the client secret came from
`appsettings.json`, so after `ab97fb3` it existed in **no** configuration source and the
deployed API could not mint its Keycloak Admin token — registration, forgot-password and
admin provisioning all broken. No GitHub CI job builds an image or runs compose, and the red
test run stopped Jenkins before `Deploy`, so nothing reported it. It is now
`KeycloakAdminClient__credentials__secret: ${KEYCLOAK_ADMIN_CLIENT_SECRET:?…}` on `api`, with
a placeholder in [ci/build.env](../../ci/build.env) — required, because
`docker compose --env-file ci/build.env build` interpolates the whole file and the
`Build & Push images` stage would otherwise fail on a variable no image uses.

**A secret deleted from the working tree is not rotated.** Everything `ab97fb3` removed is
still in the public GitHub history and has to be regenerated in Keycloak.
