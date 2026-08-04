// Stigvidd CI/CD pipeline.
//
// Flow: test -> build images -> push to registry -> deploy to a remote host
// over SSH (docker compose pull && up -d).
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
//       - id: deploy-ssh-key         type: SSH Username with private key (deploy host)
//
//  2. Plugins: SSH Agent, Timestamper. (No Docker Pipeline plugin needed —
//     nothing runs `inside` a container any more.)
//
//  3. The agent host needs:
//       - .NET SDK 10                      (backend build/test)
//       - Node.js 24 + npm                 (web lint/build)
//       - libsqlite3-mod-spatialite        (see note below)
//       - docker + `docker compose` v2, with the Jenkins user in the `docker`
//         group: `usermod -aG docker jenkins`, then restart the agent
//       - ssh + scp
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
//     Package caches (~/.nuget/packages, ~/.npm) live in the Jenkins user's
//     home and warm themselves — nothing to configure.
//
//  4. On the DEPLOY HOST, at $DEPLOY_PATH, keep a persistent `.env` holding the
//     runtime secrets that must NOT live in Jenkins/git:
//       POSTGRES_PASSWORD=...   (+ POSTGRES_DB / POSTGRES_USER / ports if non-default)
//     REGISTRY and IMAGE_TAG are injected by this pipeline at deploy time.
//
//  5. Adjust the CONFIGURE block below (registry, deploy host/path, VITE_* build
//     values). VITE_* are public (client id + URLs), baked into the web bundle.
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
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 40, unit: 'MINUTES')
  }

  environment {
    // ===== CONFIGURE ME =====================================================
    // Private registry served at inkaben.se/v2/ (Docker's root API endpoint),
    // so `inkaben.se` is both login host and namespace ->
    // images: inkaben.se/stigvidd-{api,web}:<tag>.
    REGISTRY       = 'inkaben.se'                       // registry host
    DEPLOY_HOST    = 'deploy@app-server.example.com'    // ssh target
    DEPLOY_PATH    = '/opt/stigvidd'                    // compose dir on host

    // Uncomment and adjust if the toolchains are not on the agent's default PATH.
    // PATH = "/usr/local/bin:/usr/share/dotnet:${env.PATH}"

    // Web build-time config (public values, baked into the SPA bundle).
    VITE_API_URL    = 'https://api.stigvidd.se'
    VITE_OIDC_URL   = 'https://inkaben.se/auth'
    VITE_OIDC_REALM = 'stigvidd'
    VITE_CLIENT_ID  = 'stigvidd-admin'
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
        '''
        // Immutable per-commit tag; keeps deploys traceable and rollbacks easy.
        // Resolved once here, after checkout, so every later stage agrees.
        script {
          env.IMAGE_TAG = sh(
            script: 'git rev-parse --short=12 HEAD',
            returnStdout: true).trim()
        }
        echo "Building ${env.IMAGE_TAG}"
      }
    }

    stage('Test') {
      // No per-stage agents: both branches run concurrently in the shared
      // workspace. backend/ and web/ are disjoint, so they cannot collide.
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
              sh '''
                set -e
                npm ci
                npm run lint
                npm run build
              '''
            }
          }
        }
      }
    }

    stage('Build & Push images') {
      when { branch 'main' }   // only publish from main; PRs stop after Test
      steps {
        withCredentials([usernamePassword(
          credentialsId: 'registry-credentials',
          usernameVariable: 'REG_USER',
          passwordVariable: 'REG_PASS')]) {
          // ci/build.env supplies throwaway values for compose's whole-file
          // interpolation (the required ${..:?} refs on db/api/media/proxy/
          // keycloak). Real env vars — REGISTRY, IMAGE_TAG, VITE_* — take
          // precedence over the file. Nothing from build.env is baked in.
          sh '''
            set -e
            echo "$REG_PASS" | docker login "${REGISTRY%%/*}" -u "$REG_USER" --password-stdin
            trap 'docker logout "${REGISTRY%%/*}" >/dev/null 2>&1 || true' EXIT

            # Parallelises the five image builds via buildx bake. Drop this line
            # if the agent's Docker has no buildx plugin.
            export COMPOSE_BAKE=true

            docker compose --env-file ci/build.env build api web media proxy keycloak
            docker compose --env-file ci/build.env push api web media proxy keycloak
          '''
        }
      }
      post {
        always {
          // The agent's Docker daemon is long-lived and every main build tags
          // five new per-commit images — without this the disk fills up.
          // Keeps the current build's tags so their layers stay cached.
          sh '''
            [ -n "${IMAGE_TAG:-}" ] || exit 0
            docker image ls --filter "reference=${REGISTRY}/stigvidd-*:*" \
                            --format '{{.Repository}}:{{.Tag}}' \
              | grep -v ":${IMAGE_TAG}$" \
              | xargs -r docker rmi || true
            docker image prune -f >/dev/null || true
          '''
        }
      }
    }

    stage('Deploy') {
      when { branch 'main' }
      steps {
        withCredentials([usernamePassword(
          credentialsId: 'registry-credentials',
          usernameVariable: 'REG_USER',
          passwordVariable: 'REG_PASS')]) {
          sshagent(credentials: ['deploy-ssh-key']) {
            sh '''
              set -e
              # StrictHostKeyChecking left to the agent's known_hosts; pre-seed it
              # once with: ssh-keyscan app-server.example.com >> ~/.ssh/known_hosts
              ssh -o BatchMode=yes "${DEPLOY_HOST}" "mkdir -p ${DEPLOY_PATH}/db/init"
              scp docker-compose.yml "${DEPLOY_HOST}:${DEPLOY_PATH}/docker-compose.yml"
              scp db/init/01-postgis.sql "${DEPLOY_HOST}:${DEPLOY_PATH}/db/init/01-postgis.sql"

              # Authenticate the deploy host to the private registry so it can
              # pull. Password is piped over ssh stdin (never in argv/logs).
              echo "$REG_PASS" | ssh -o BatchMode=yes "${DEPLOY_HOST}" \
                "docker login ${REGISTRY%%/*} -u '$REG_USER' --password-stdin"

              # REGISTRY/IMAGE_TAG override the host .env; POSTGRES_PASSWORD etc.
              # come from the persistent .env already on the host.
              ssh -o BatchMode=yes "${DEPLOY_HOST}" "cd ${DEPLOY_PATH} && \
                REGISTRY=${REGISTRY} IMAGE_TAG=${IMAGE_TAG} docker compose pull && \
                REGISTRY=${REGISTRY} IMAGE_TAG=${IMAGE_TAG} docker compose up -d --remove-orphans && \
                docker image prune -f"
            '''
          }
        }
      }
    }
  }
}
