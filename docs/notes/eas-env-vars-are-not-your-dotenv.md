# An EAS build never sees `app/.env`, and `eas.json` does not say which variables it does see

EAS Build uploads the working tree — uncommitted and untracked files included, since
`requireCommit` defaults to false — but it drops whatever `.gitignore` drops. `app/.env` is
git-ignored, so a cloud build never receives it. What a build actually reads is the set of
variables held on EAS, per environment:

```sh
cd app
npx eas env:list --environment preview
npx eas env:create preview --name EXPO_PUBLIC_FOO --value ... --visibility plaintext
```

## The failure is silent

`EXPO_PUBLIC_*` variables are **inlined into the bundle at build time**. A name that is not
set inlines as `undefined` — nothing fails, nothing warns. So renaming an `EXPO_PUBLIC_*` in
`app/src/api/` and forgetting to add the new name on EAS produces a build whose `BASE_URL`
is the string `undefined/...`, and the first sign of it is every request failing on a
device.

## Which environment a profile gets is inferred, not declared

The profiles in [app/eas.json](../../app/eas.json) declare no `environment`, so eas-cli
infers one: store distribution to `production`, a `developmentClient` profile to
`development`, everything else to `preview`.

## `eas update` is the real trap

Without `--environment` the update bundles from your **local `.env`** and pushes it over the
air — which is how a laptop's LAN address reaches testers. It prompts for the environment
only from SDK 55 up, and this app is on Expo 54, so it does not prompt here:

```sh
npx eas update --branch preview --environment preview
```

## Two more that surprise

- Locally, `.env.local` beats `.env`.
- A variable marked **SENSITIVE** on EAS is still inlined into the APK/IPA. Sensitive
  controls who can read it in the EAS UI and logs, not whether it ships in the client.

Documented in [README.md](../../README.md) under "Builds and OTA updates read a different
set of variables".
