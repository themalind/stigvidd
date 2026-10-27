# A `docker compose push` to lingonberg.se occasionally drops mid-blob with "write: broken pipe"

Seen in Jenkins build logs (`~/Downloads/#92.txt`, main branch, commit `3e58ddf894ad`, 2026-10-27):
build and all tests green, `docker compose --env-file ci/build.env push $IMAGES` fails partway
through with

```
Error response from daemon: {"errorDetail":{"message":"writing blob: Patch
\"https://lingonberg.se/v2/stigvidd-keycloak/blobs/uploads/...\": write tcp ...: write: broken
pipe"}, ...}
```

Most images (api, web, site, link, media, proxy) pushed fine in the same run; one blob
(keycloak, the largest image) hit a dropped connection. This had already happened on `staging`
before it hit `main` — same `buildAndPush` closure in [`Jenkinsfile`](../../Jenkinsfile), shared
by both branches, with no retry anywhere around the push step. ERROR exit code 1 from the push
fails the whole "Build & Push images" stage, which skips Deploy even though nothing about the
build or the images was wrong.

Fix: `Jenkinsfile`'s `buildAndPush` wraps `docker compose push $IMAGES` and the per-service
moving-tag `docker push` in a `push_with_retry` shell function (3 attempts, linear backoff).
Only the push retries, not `docker compose build` — the image is already built locally, so
re-running the build on a push flake would waste the build time for nothing.

If this recurs after the retry (three failures in a row), suspect something more persistent at
the registry host itself, not a one-off network blip.

To diagnose a Jenkins log like this, skip straight to the tail: `grep -niE
"error|fail|exception|broken pipe" <log>` on the whole file finds nothing useful (hits only
self-test/stage names), because the real error sits in the last ~150 lines after a long clean
build/test run — read the tail first. The push step itself is `grep -n "push\|REGISTRY"
Jenkinsfile`; `buildAndPush` is the one closure both `main` and `staging` share, so a fix there
covers both branches at once — no need to special-case per branch.

Decision: for a transient failure in an external step (registry push, not the repo's own
build/test), wrap just that step in a shell-level retry loop, not Jenkins' `retry()` around the
whole stage — `retry()` would re-run `docker compose build` too, which is pure waste since the
image is already built and only the upload flaked.
