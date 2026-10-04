// Stigvidd CI/CD pipeline.
//
// Flow: test -> build images -> push to registry -> deploy to a remote host
// over SSH (docker compose pull && up -d).
//
// Branches (multibranch job):
//   main     production. Builds, pushes and deploys all six images.
//   staging  staging. Builds/pushes api web site media proxy tagged <sha>-staging
//            plus a moving `staging`, with the staging web build args, and deploys
//            to STAGING_DEPLOY_HOST (skipped, still green, while that is unset).
//   others   (feature branches, PRs) stop after Test.
// Per-branch values are resolved ONCE, in Preflight — see "Resolve per-branch config".
//
// The agent runs directly on the Jenkins host — the toolchains are installed
// natively, so only the *image builds* use Docker.
//
// ─────────────────────────────────────────────────────────────────────────
// One-time setup on the Jenkins controller / agent:
//
//  1. Credentials (Manage Jenkins > Credentials):
//       - id: registry-credentials   type: Username/Password
//           registry: https://inkaben.se/  (host inkaben.se, API at /v2/)
//           user: stigvidd   (password stored in Jenkins, never in git)
//       - id: deploy-ssh-key         type: SSH Username with private key (deploy host;
//                                    also used for the staging host, so authorise
//                                    its public key there too)
//       - id: staging-oo-logs-token  type: Secret text — the staging OpenObserve org's
//           web@ INGESTION token (baked into the staging web bundle). OPTIONAL: if the
//           credential does not exist the staging web image is built with no token and
//           web/src/services/telemetry.ts installs no log sink.
//
//     Global environment variables (Manage Jenkins > System > Global properties >
//     Environment variables):
//       - STAGING_DEPLOY_HOST   e.g. stigvidd@staging-host. While unset/empty the
//           staging build pushes images and SKIPS the deploy (green).
//       - STAGING_OO_LOGS_URL   https://observatory.stigvidd.se/api/<staging-org-id>/stigvidd_web_logs/_json
//           Optional; empty builds the web image without telemetry.
//
//  2. Plugins: SSH Agent, Timestamper, Lockable Resources (the `lock` option below
//     serialises main and staging builds across the multibranch job). (No Docker
//     Pipeline plugin needed — nothing runs `inside` a container any more.)
//
//     The `staging` branch must exist in the remote (git push origin staging) for the
//     multibranch job to discover it and build it.
//
//  3. The agent host needs:
//       - .NET SDK 10                      (backend build/test)
//       - Node.js 24 + npm                 (web lint/build)
//       - libsqlite3-mod-spatialite        (see note below)
//       - docker + `docker compose` v2, with the Jenkins user in the `docker`
//         group: `usermod -aG docker jenkins`, then restart the agent
//       - ssh + scp, with the deploy host in the jenkins user's
//         ~/.ssh/known_hosts. An unseeded or stale entry fails the Deploy
//         stage at exit 255 ("Host key verification failed") before it
//         authenticates — re-seed per the comment in that stage. Do the same for the
//         STAGING host (ssh-keyscan -H <staging host>) before the first staging deploy.
//
//     SpatiaLite: IntegrationTests.csproj references Sqlite.Core +
//     SQLitePCLRaw.provider.sqlite3 on Unix (rather than the bundled provider)
//     precisely so it links the SYSTEM sqlite and can load mod_spatialite.
//     Without the package the integration tests fail at DbContext setup:
//       apt-get install -y libsqlite3-mod-spatialite libspatialite-dev
//
//     PATH: Jenkins runs `sh` steps in a non-login shell, so anything installed
//     outside /usr/bin may be missing. If `dotnet` or `node` are not found, add
//     them via Manage Jenkins > Tools, or uncomment the PATH line below.
//
//     Container network: the image builds run apt-get and `dotnet restore`
//     inside build containers. Image PULLS are performed by the daemon over the
//     host's network, so they keep working even when containers have no usable
//     egress — the failure then shows up only as "Temporary failure resolving"
//     minutes into `compose build`. The host resolving names is NOT evidence
//     that containers can: they reach the nameserver from the bridge subnet,
//     which the network may not route or the resolver may not answer.
//     Preflight probes the build path so this fails immediately and by name.
//
//     Package caches (~/.nuget/packages, ~/.npm) live in the Jenkins user's
//     home and warm themselves — nothing to configure.
//
//  4. On the DEPLOY HOST, at $DEPLOY_PATH, keep a persistent `.env` holding the
//     runtime secrets that must NOT live in Jenkins/git:
//       POSTGRES_PASSWORD=...   (+ POSTGRES_DB / POSTGRES_USER / ports if non-default)
//       KEYCLOAK_ADMIN_CLIENT_SECRET=...  (stigvidd-admin-api's client secret; the API
//         cannot reach the Keycloak Admin API without it, and compose refuses to
//         interpolate the file at all while it is missing — so the deploy's own
//         `pull`/`up` fails first. See DEPLOYMENT.md Part 1.)
//     REGISTRY and IMAGE_TAG are injected by this pipeline at deploy time.
//
//  5. Adjust the CONFIGURE block below (registry) and the per-branch map in
//     Preflight (deploy host/path, VITE_* build values). VITE_* are baked into the
//     web bundle, so the web image is per environment; the OO token is a secret
//     for staging (credential) and — historically — inline for production.
// ─────────────────────────────────────────────────────────────────────────

pipeline {
  // One agent, one workspace, one checkout for the whole run. Every stage
  // reuses it, so bin/obj and node_modules survive between builds and the
  // Build/Deploy stages don't re-clone the repo.
  agent any

  options {
    timestamps()
    // Also protects the shared ~/.nuget and ~/.npm caches from concurrent
    // writes now that builds are not isolated in containers.
    disableConcurrentBuilds()
    // ...and across branches: a main and a staging build must not run at once on
    // the one agent (shared workspace caches, one Docker daemon, image pruning).
    // Needs the Lockable Resources plugin.
    lock(resource: 'stigvidd-ci')
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 40, unit: 'MINUTES')
  }

  environment {
    // ===== CONFIGURE ME =====================================================
    // Private registry served at inkaben.se/v2/ (Docker's root API endpoint),
    // so `inkaben.se` is both login host and namespace ->
    // images: inkaben.se/stigvidd-{api,web}:<tag>.
    REGISTRY       = 'lingonberg.se'                       // registry host
    // DEPLOY_HOST, DEPLOY_PATH, IMAGES and the VITE_* values differ per branch
    // and are set in Preflight ("Resolve per-branch config").

    // Uncomment and adjust if the toolchains are not on the agent's default PATH.
    // PATH = "/usr/local/bin:/usr/share/dotnet:${env.PATH}"

    // ========================================================================

    DOTNET_NOLOGO = '1'
    DOTNET_CLI_TELEMETRY_OPTOUT = '1'
    // Nothing here is interactive; stop npm from rendering progress bars into
    // the build log.
    NPM_CONFIG_FUND = 'false'
    NPM_CONFIG_AUDIT = 'false'
    NPM_CONFIG_PROGRESS = 'false'
  }

  stages {
    stage('Preflight') {
      steps {
        // Fails in one obvious place with a readable message instead of
        // "dotnet: not found" halfway through a parallel stage.
        sh '''
          set -e
          dotnet --version
          node --version
          npm --version
          docker compose version

          # Several web deps declare engines >=22 (orval wants >=22.18). On an
          # older Node, npm only prints EBADENGINE warnings and carries on, so
          # assert it here instead of shipping a bundle built by a Node the
          # dependencies never claimed to support.
          NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
          if [ "$NODE_MAJOR" -lt 22 ]; then
            echo "ERROR: agent Node is v$NODE_MAJOR; web dependencies require >= 22." >&2
            exit 1
          fi
          if [ "$NODE_MAJOR" != "24" ]; then
            echo "WARNING: agent Node is v$NODE_MAJOR but web/Dockerfile builds the" >&2
            echo "         shipped bundle on node:24-alpine. Keep the two in step." >&2
          fi

          # Image builds run apt-get and `dotnet restore` INSIDE build
          # containers. Image PULLS are done by the daemon and use the host's
          # network, so they succeed even when the container network is broken —
          # which is why that failure only ever surfaces minutes into
          # `compose build`. Probe the same path here (a build, not a
          # `docker run`: the two can resolve differently). --no-cache stops
          # BuildKit from caching a pass and never re-testing.
          if ! printf 'FROM alpine:3\\nRUN getent hosts api.nuget.org\\n' \\
               | docker build --no-cache -q - >/dev/null 2>&1; then
            echo "ERROR: build containers cannot resolve api.nuget.org." >&2
            echo "       The host resolving fine does not cover this: the" >&2
            echo "       container needs its own route to that nameserver." >&2
            echo "       Compare host and container resolvers with:" >&2
            echo "         cat /etc/resolv.conf" >&2
            echo "         docker run --rm alpine:3 cat /etc/resolv.conf" >&2
            exit 1
          fi
        '''
        // The agent harness in .claude/: every hook's self-test, its registrations, and
        // docs/notes/INDEX.md against the files. Node only, ~2 s, no install needed. Here
        // rather than in a Test stage because a broken hook should stop the build before
        // it spends minutes on dotnet and npm.
        sh 'node scripts/check-hooks.mjs'

        // web/openapi.json is gitignored, so a fresh checkout has none — and the web
        // stage's `npm run generate:api` needs it as input. It cannot wait for the
        // backend stage: the two run in PARALLEL in this shared workspace. So it is
        // produced here, in the sequential stage that precedes both. The backend build
        // this warms is reused by that stage.
        //
        // Nothing extra is run to get it: StigviddAPI.csproj's GenerateOpenApiSpec target
        // exports the document after every Debug build, so `dotnet build` IS the step.
        // It used to be `dotnet test --filter-class OpenApiContractTests`, which wrote the
        // file as a side effect and FAILED whenever it had to change — and because this
        // workspace persists between builds, a leftover snapshot from the previous commit
        // was enough to fail it while nothing was actually wrong.
        dir('backend') {
          sh '''
            set -e
            dotnet restore
            dotnet build --no-restore
          '''
        }
        // The target is ContinueOnError, so a failure to generate only warns. This is the
        // one place it becomes a red build, and it has to be: the web stage cannot run
        // without the file.
        sh '''
          set -e
          if [ ! -s web/openapi.json ]; then
            echo "ERROR: web/openapi.json was not produced by the StigviddAPI build." >&2
            echo "       The web stage cannot run generate:api without it." >&2
            echo "       Look for 'generate-openapi : error' earlier in this log." >&2
            exit 1
          fi
        '''

        // Resolve per-branch config. Everything that differs between production
        // (main) and staging is set here, once, after checkout, so every later stage
        // agrees. Other branches get only IMAGE_TAG: they stop after Test.
        //
        // main    : the values that used to live in the environment block, unchanged.
        // staging : own host/path, `<sha>-staging` tags + moving `staging`, no keycloak
        //           (staging borrows production's), and the staging web build args.
        // IMAGE_TAG is an immutable per-commit tag; keeps deploys traceable and
        // rollbacks easy.
        script {
          def sha = sh(
            script: 'git rev-parse --short=12 HEAD',
            returnStdout: true).trim()
          env.IMAGE_TAG = sha
          if (env.BRANCH_NAME == 'main') {
            env.DEPLOY_HOST        = 'stigvidd@stigvidd.se'
            env.DEPLOY_PATH        = '/opt/stigvidd'
            env.MOVING_TAG         = 'latest'
            env.IMAGES             = 'api web site media proxy keycloak'
            env.DEPLOY_DIRS        = 'db/init scripts observability'
            env.COPY_OBSERVABILITY = 'true'
            env.COMPOSE_FILES      = 'docker-compose.yml'
            env.REMOTE_COMPOSE_ENV = ''
            env.VITE_API_URL       = 'https://api.stigvidd.se'
            env.VITE_OIDC_URL      = 'https://auth.stigvidd.se'
            env.VITE_OIDC_REALM    = 'stigvidd'
            env.VITE_CLIENT_ID     = 'stigvidd-admin'
            env.VITE_OO_LOGS_URL   = 'https://observatory.stigvidd.se/api/3Igh0Ez9tpaLNBgzzVouYA1NyT5/stigvidd_web_logs/_json'
            env.VITE_OO_LOGS_TOKEN = 'c3RpZ3ZpZGQtcHJvZHVjdGlvbi13ZWI6bzJvaV9PcTZHNHo5VGR4UXFpYmhJMjlQU1RENGFXRlhWNHdMTg=='
          } else if (env.BRANCH_NAME == 'staging') {
            env.IMAGE_TAG          = "${sha}-staging"
            // Global env var; unset until the staging host exists -> deploy is skipped.
            env.DEPLOY_HOST        = env.STAGING_DEPLOY_HOST ?: ''
            env.DEPLOY_PATH        = '/opt/stigvidd-staging'
            env.MOVING_TAG         = 'staging'
            env.IMAGES             = 'api web site media proxy'
            env.DEPLOY_DIRS        = 'db/init scripts'
            env.COPY_OBSERVABILITY = 'false'
            env.COMPOSE_FILES      = 'docker-compose.yml docker-compose.staging.yml'
            // Explicit, so the host's .env cannot forget the override (it would then
            // run the full Caddyfile).
            env.REMOTE_COMPOSE_ENV = 'COMPOSE_FILE=docker-compose.yml:docker-compose.staging.yml'
            env.VITE_API_URL       = 'https://staging.api.stigvidd.se'
            env.VITE_OIDC_URL      = 'https://auth.stigvidd.se'
            env.VITE_OIDC_REALM    = 'stigvidd-staging'
            env.VITE_CLIENT_ID     = 'stigvidd-admin'
            env.VITE_OO_LOGS_URL   = env.STAGING_OO_LOGS_URL ?: ''
            // The token is bound from the staging-oo-logs-token credential in the
            // Build stage; empty here is the "credential missing" fallback.
            env.VITE_OO_LOGS_TOKEN = ''
          }
        }
        echo "Branch ${env.BRANCH_NAME}: building ${env.IMAGE_TAG}"
      }
    }

    stage('Test') {
      // No per-stage agents: all three branches run concurrently in the shared
      // workspace. backend/, web/ and site/ are disjoint, so they cannot collide.
      parallel {
        stage('backend') {
          steps {
            dir('backend') {
              sh '''
                set -e
                dotnet restore
                dotnet build --no-restore
              '''
              // Tests swap in SQLite in-memory; the connection string only has
              // to satisfy the startup null-check (mirrors the GitHub CI).
              withEnv(['ConnectionStrings__StigVidd=DataSource=:memory:']) {
                sh 'dotnet test --no-build'
              }
            }
          }
        }

        stage('web') {
          steps {
            dir('web') {
              // `npm run build` is `tsc -b && vite build` — it is the type
              // check, and it fails fast on PRs that never reach the image
              // build below.
              //
              // generate:api reads web/openapi.json, which is NOT committed —
              // Preflight produced it, because this stage runs in parallel with
              // the backend one and so cannot wait for it. This step only catches
              // a contract change that was never regenerated into the client,
              // which IS committed.
              //
              // STIGVIDD_SKIP_API_CODEGEN switches off the predev/prebuild hook in
              // web/package.json. Without it `npm run build` below would regenerate
              // the client a second time — after the gate, so it could not hide a
              // stale one, but it is a wasted API host boot. The explicit sequence
              // here is the one that gates the deploy, so it stays explicit.
              //
              // `npm test` is `vitest run` — vitest.config.ts, not vite.config.ts,
              // and it needs no server and no backend. GitHub Actions runs the same
              // three steps in its own web job; this stage is what gates the DEPLOY,
              // and it is the only place the staleness check above runs.
              withEnv(['STIGVIDD_SKIP_API_CODEGEN=true']) {
                sh '''
                  set -e
                  npm ci
                  npm run lint
                  npm run generate:api
                  if ! git diff --exit-code -- src/api/generated; then
                    echo "ERROR: the generated API client is stale." >&2
                    echo "       Run 'npm run generate:api' in web/ and commit the result." >&2
                    exit 1
                  fi
                  npm test
                  npm run build
                '''
              }
            }
          }
        }

        stage('site') {
          steps {
            dir('site') {
              // The public landing page. No generate:api and no staleness gate: the
              // site has no API client at all, which is what makes it independent of
              // Preflight's openapi.json and safe to run in parallel with everything.
              sh '''
                set -e
                npm ci
                npm run lint
                npm test
                npm run build
              '''
            }
          }
        }
      }
    }

    stage('Build & Push images') {
      // Only main (production) and staging publish; PRs and other branches stop
      // after Test.
      when { anyOf { branch 'main'; branch 'staging' } }
      steps {
        script {
          // ci/build.env supplies throwaway values for compose's whole-file
          // interpolation (the required ${..:?} refs on db/api/media/proxy/
          // keycloak). Real env vars — REGISTRY, IMAGE_TAG, VITE_* — take
          // precedence over the file. Nothing from build.env is baked in.
          // $IMAGES and $MOVING_TAG are per-branch (Preflight). Single-quoted:
          // Groovy does not interpolate, the shell expands them.
          def buildAndPush = {
            withCredentials([usernamePassword(
              credentialsId: 'registry-credentials',
              usernameVariable: 'REG_USER',
              passwordVariable: 'REG_PASS')]) {
              sh '''
                set -e
                echo "$REG_PASS" | docker login "${REGISTRY%%/*}" -u "$REG_USER" --password-stdin
                trap 'docker logout "${REGISTRY%%/*}" >/dev/null 2>&1 || true' EXIT

                # Parallelises the image builds via buildx bake. Drop this line
                # if the agent's Docker has no buildx plugin.
                export COMPOSE_BAKE=true

                docker compose --env-file ci/build.env build $IMAGES
                docker compose --env-file ci/build.env push $IMAGES

                # Also publish a moving tag (`latest` on main, `staging` on staging) so
                # a deploy host can pin IMAGE_TAG once instead of editing .env for every
                # commit. This stage only runs on main/staging, so each tag always means
                # the current head of its branch. The per-commit tags stay immutable,
                # for pinning and rollback.
                # Assumes the compose image names stay ${REGISTRY}/stigvidd-<service>.
                for svc in $IMAGES; do
                  docker tag  "${REGISTRY}/stigvidd-${svc}:${IMAGE_TAG}" "${REGISTRY}/stigvidd-${svc}:${MOVING_TAG}"
                  docker push --quiet "${REGISTRY}/stigvidd-${svc}:${MOVING_TAG}"
                done
              '''
            }
          }

          if (env.BRANCH_NAME == 'staging') {
            // The staging web token is optional. Probe for the credential first, so a
            // missing one is told apart from a failing build (which must stay red).
            def haveToken = true
            try {
              withCredentials([string(credentialsId: 'staging-oo-logs-token', variable: 'PROBE')]) { }
            } catch (err) {
              haveToken = false
            }
            if (haveToken) {
              // Bound as an env var, masked in the log, never in argv. Compose reads
              // VITE_OO_LOGS_TOKEN from the environment.
              withCredentials([string(credentialsId: 'staging-oo-logs-token', variable: 'VITE_OO_LOGS_TOKEN')]) {
                buildAndPush()
              }
            } else {
              echo 'Credential staging-oo-logs-token not found: building the staging web image without telemetry.'
              buildAndPush()
            }
          } else {
            buildAndPush()
          }
        }
      }
      post {
        always {
          // The agent's Docker daemon is long-lived and every build tags new
          // per-commit images — without this the disk fills up.
          // Keeps the current build's tags (and the moving tag) so their layers stay
          // cached. A staging build prunes only staging tags (-staging / staging) and
          // a main build only the others, so neither wipes the other's cache.
          sh '''
            [ -n "${IMAGE_TAG:-}" ] || exit 0
            if [ "${BRANCH_NAME}" = "staging" ]; then
              KIND='grep -E'
            else
              KIND='grep -Ev'
            fi
            docker image ls --filter "reference=${REGISTRY}/stigvidd-*:*" \
                            --format '{{.Repository}}:{{.Tag}}' \
              | $KIND ':(.*-staging|staging)$' \
              | grep -v ":${IMAGE_TAG}$" \
              | grep -v ":${MOVING_TAG}$" \
              | xargs -r docker rmi || true
            docker image prune -f >/dev/null || true
          '''
        }
      }
    }

    stage('Deploy (skipped: no host)') {
      // Staging before STAGING_DEPLOY_HOST is configured: images are pushed, deploy
      // is skipped, the build stays green.
      when {
        allOf {
          branch 'staging'
          expression { return !(env.DEPLOY_HOST?.trim()) }
        }
      }
      steps {
        echo "staging host not configured (STAGING_DEPLOY_HOST unset); images pushed as ${env.IMAGE_TAG} (and moving tag ${env.MOVING_TAG}), deploy skipped"
      }
    }

    stage('Deploy') {
      when {
        allOf {
          anyOf { branch 'main'; branch 'staging' }
          expression { return env.DEPLOY_HOST?.trim() as boolean }
        }
      }
      steps {
        withCredentials([usernamePassword(
          credentialsId: 'registry-credentials',
          usernameVariable: 'REG_USER',
          passwordVariable: 'REG_PASS')]) {
          sshagent(credentials: ['deploy-ssh-key']) {
            sh '''
              set -e
              # Host-key trust is the agent's known_hosts. If the deploy host is
              # missing or stale there, this stage dies on the first ssh with
              # "Host key verification failed" (exit 255) before authentication is
              # even attempted. Re-seed it, as the jenkins user, and check the
              # fingerprint against the deploy host before trusting it:
              # (Same for the staging host: substitute its name.)
              #   sudo -u jenkins ssh-keygen -R stigvidd.se -f /var/lib/jenkins/.ssh/known_hosts
              #   sudo -u jenkins sh -c 'ssh-keyscan -H stigvidd.se >> /var/lib/jenkins/.ssh/known_hosts'
              # $DEPLOY_DIRS: db/init scripts (+ observability on main).
              REMOTE_DIRS=""
              for d in $DEPLOY_DIRS; do REMOTE_DIRS="$REMOTE_DIRS ${DEPLOY_PATH}/$d"; done
              ssh -o BatchMode=yes "${DEPLOY_HOST}" "mkdir -p $REMOTE_DIRS"
              # $COMPOSE_FILES: docker-compose.yml, plus docker-compose.staging.yml on staging.
              for f in $COMPOSE_FILES; do
                scp "$f" "${DEPLOY_HOST}:${DEPLOY_PATH}/$f"
              done
              # The host's operational scripts. DEPLOYMENT.md invokes all of these
              # as ./scripts/<name>.sh from the compose directory, and
              # container-log-retention.sh is run by a systemd timer there — so
              # unlike the one-off scripts it has to stay CURRENT, not merely be
              # present once. Without this scp a fix to it would live only in git
              # while the host kept running the copy someone hand-placed months
              # ago, with nothing reporting the drift. scp does not reliably carry
              # the executable bit, hence the chmod.
              scp scripts/*.sh "${DEPLOY_HOST}:${DEPLOY_PATH}/scripts/"
              ssh -o BatchMode=yes "${DEPLOY_HOST}" "chmod +x ${DEPLOY_PATH}/scripts/*.sh"
              # Every NN-*.sql, not just postgis — 02-keycloak-db.sql creates the
              # keycloak database and was previously never copied. These only run
              # against an EMPTY pgdata, so this is inert on a live host; it keeps
              # a future rebuild from coming up without Keycloak's database.
              scp db/init/*.sql "${DEPLOY_HOST}:${DEPLOY_PATH}/db/init/"
              # The hostmetrics collector's config. It is a BIND MOUNT in
              # docker-compose.yml, not baked into an image, so a host without this
              # file gets a container that will not start — and because the service
              # sits behind a compose profile and is absent from the up-set below,
              # that would surface whenever someone next ran it by hand rather than
              # on the deploy that broke it.
              # Production only: staging runs no hostmetrics collector.
              if [ "$COPY_OBSERVABILITY" = "true" ]; then
                scp observability/*.yaml "${DEPLOY_HOST}:${DEPLOY_PATH}/observability/"
              fi

              # Authenticate the deploy host to the private registry so it can
              # pull. Password is piped over ssh stdin (never in argv/logs).
              echo "$REG_PASS" | ssh -o BatchMode=yes "${DEPLOY_HOST}" \
                "docker login ${REGISTRY%%/*} -u '$REG_USER' --password-stdin"

              # REGISTRY/IMAGE_TAG override the host .env; POSTGRES_PASSWORD etc.
              # come from the persistent .env already on the host.
              #
              # Scoped to the images this pipeline builds ($IMAGES: six on main, five on
              # staging, which borrows production's keycloak), deliberately NOT
              # `db`. An unscoped `pull` would re-pull postgis/postgis:17-3.5 and
              # `up -d` would then recreate the live database container whenever
              # upstream moves that tag. --no-deps stops compose from touching db
              # as a dependency of api/keycloak. Consequence: a postgis bump in
              # docker-compose.yml is NOT applied by CI — that stays a manual
              # operation, on purpose (see DEPLOYMENT.md Part 3).
              #
              # No --remove-orphans: paired with a scoped `up` it can remove
              # containers outside the named set. Recreating these keeps all
              # named volumes (pgdata, media, caddy_data, caddy_config) intact.
              ssh -o BatchMode=yes "${DEPLOY_HOST}" "cd ${DEPLOY_PATH} && \
                ${REMOTE_COMPOSE_ENV} REGISTRY=${REGISTRY} IMAGE_TAG=${IMAGE_TAG} docker compose pull ${IMAGES} && \
                ${REMOTE_COMPOSE_ENV} REGISTRY=${REGISTRY} IMAGE_TAG=${IMAGE_TAG} docker compose up -d --no-deps ${IMAGES} && \
                docker image prune -f"
            '''
          }
        }
      }
    }
  }
}
