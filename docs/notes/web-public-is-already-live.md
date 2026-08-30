# Anything in `web/public/` is already live — an HTML comment never gated it

Three hand-written legal pages sit in `web/public/{privacy-policy,terms-of-use,delete-account}/index.html`.
Each opened with a block like:

```html
<!--
  UTKAST. FÅR INTE DEPLOYAS FÖRRÄN:
    1. Alla <span class="todo">-markeringar är ersatta.
-->
```

Read as an instruction to a human that is fine. Read as a deploy gate it is nothing at all:
**every file under `web/public/` reaches production on the next merge to `main`, with no
route, no config and no opt-in.** The bundler copies `publicDir` verbatim into `dist/`,
`web/Dockerfile` copies `dist/` into `/usr/share/nginx/html`, and Jenkins pushes the image.
A draft legal document parked there is published the moment the branch merges — and the
comment saying otherwise travels with it, inside the served HTML.

The `.todo` CSS is the part that *does* work, because it fails visibly: an unreplaced
`<span class="todo">` renders as a red block on the live page. Keep using it. Do not mistake
the surrounding comment for a mechanism.

## Why the wrong model is so easy to reach

"Make these pages appear in the deployed web" reads like something is excluding them, and a
whole search follows — `.dockerignore`, the bundler's `publicDir` setting, the `Jenkinsfile`,
`proxy/Caddyfile`, `.gitignore`, a `robots`/`noindex` meta. None of it exists. `web/dist/`
already contained all three. The pages were shipping the entire time; only the *comments*
and the absence of any link to them said otherwise.

So the question to ask of a `web/public/` file is never "how do I deploy this" but "is this
fit to be public right now".

## They are files, not routes, and that changes three things

`web/src/router/router.tsx` knows nothing about them. Verified by building the real image
(`podman build -f web/Dockerfile web/`) and curling it:

1. **Link with a plain `<a href>`, never react-router's `<Link>`.** `Link` handles the click
   client-side, matches no route, and renders `NotFoundPage` — the server is never asked for
   the file. See the comment in `web/src/pages/comming-soon/comming-soon-page.tsx`.
2. **The trailing slash is load-bearing.** These are *directories*. `/privacy-policy/` is
   200; `/privacy-policy` is a 301 to the slashed form. `app/src/constants/constants.ts` and
   the Play Console entries use the slashed form and never pay for it; a human typing the URL
   does.
3. **That 301's `Location` was absolute and built from the scheme *inside* the container** —
   `http://`, port 80 — so a visitor arriving over TLS got bounced back to plain http and
   through Caddy's redirect again. nginx's default is `absolute_redirect on`, and it is wrong
   behind any TLS-terminating proxy. `web/nginx.conf` now sets `absolute_redirect off;`, which
   makes the redirect relative and preserves whatever scheme, host and port the client used.
   Nothing surfaces this: the SPA fallback (`try_files ... /index.html`) means no path 404s,
   so the only way to see it is to curl a directory path against the built image.

Related: [[json-file-has-no-time-retention]] — the same publication turned §5's stated 7-day
log retention into a promise that had to be made true.
