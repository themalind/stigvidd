// Stigvidd CI/CD pipeline.
//
// Flow: test -> build images -> push to registry -> deploy to a remote host
// over SSH (docker compose pull && up -d).
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
//  2. Plugins: Docker Pipeline, SSH Agent, Workspace Cleanup, Timestamper.
//
//  3. The agent runs directly on the host (NOT itself in a container) and needs:
//       - docker + `docker compose` v2, with the Jenkins user in the `docker`
//         group (`usermod -aG docker jenkins`, then restart the agent)
//       - ssh + scp
//     No .NET SDK or Node is required on the host — the test stages bring their
//     own toolchain containers.
//
//  4. Package caches, so restores don't re-download the world every build.
//     Create them once, owned by the Jenkins user (uid the agent runs as):
//       sudo install -d -o jenkins -g jenkins /var/lib/jenkins-cache/nuget
//       sudo install -d -o jenkins -g jenkins /var/lib/jenkins-cache/npm
//     Adjust CACHE_ROOT below if you put them elsewhere.
//
//  5. On the DEPLOY HOST, at $DEPLOY_PATH, keep a persistent `.env` holding the
//     runtime secrets that must NOT live in Jenkins/git:
//       POSTGRES_PASSWORD=...   (+ POSTGRES_DB / POSTGRES_USER / ports if non-default)
//     REGISTRY and IMAGE_TAG are injected by this pipeline at deploy time.
//
//  6. Adjust the CONFIGURE block below (registry, deploy host/path, VITE_* build
//     values). VITE_* are public (client id + URLs), baked into the web bundle.
// ─────────────────────────────────────────────────────────────────────────

pipeline {
  agent none

  options {
    timestamps()
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

    // Web build-time config (public values, baked into the SPA bundle).
    VITE_API_URL    = 'https://api.stigvidd.se'
    VITE_OIDC_URL   = 'https://inkaben.se/auth'
    VITE_OIDC_REALM = 'stigvidd'
    VITE_CLIENT_ID  = 'stigvidd-admin'
    // ========================================================================

    // Quieter, faster toolchains inside the test containers.
    DOTNET_NOLOGO = '1'
    DOTNET_CLI_TELEMETRY_OPTOUT = '1'
    // IMAGE_TAG is resolved from the checked-out commit in 'Build & Push'
    // (env.GIT_COMMIT is not reliably populated while `agent none` is active).
  }

  stages {
    stage('Test') {
      parallel {
        stage('backend') {
          agent {
            // Built locally from ci/backend-test.Dockerfile and layer-cached on
            // the agent, so the SpatiaLite install is not re-run per build.
            // Runs as the Jenkins uid (no `-u root`) — root-owned bin/obj in a
            // host workspace is what makes the *next* build fail on cleanup.
            // That uid has no /etc/passwd entry in the image, hence explicit
            // HOME/DOTNET_CLI_HOME pointing somewhere writable.
            dockerfile {
              dir 'ci'
              filename 'backend-test.Dockerfile'
              args '-e HOME=/tmp -e DOTNET_CLI_HOME=/tmp ' +
                   '-e NUGET_PACKAGES=/cache/nuget ' +
                   '-v /var/lib/jenkins-cache/nuget:/cache/nuget'
            }
          }
          steps {
            dir('backend') {
              sh '''
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
          post { always { cleanWs() } }
        }

        stage('web') {
          agent {
            docker {
              image 'node:24'
              args '-e HOME=/tmp -e npm_config_cache=/cache/npm ' +
                   '-v /var/lib/jenkins-cache/npm:/cache/npm'
            }
          }
          steps {
            dir('web') {
              sh '''
                npm ci
                npm run lint
                npm run build
              '''
            }
          }
          post { always { cleanWs() } }
        }
      }
    }

    stage('Build & Push images') {
      agent any
      when { branch 'main' }   // only publish from main; PRs stop after Test
      steps {
        // Immutable per-commit tag; keeps deploys traceable and rollbacks easy.
        // Read from the working tree after checkout so every later stage sees
        // the same value.
        script {
          env.IMAGE_TAG = sh(
            script: 'git rev-parse --short=12 HEAD',
            returnStdout: true).trim()
        }
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
            # Bail out rather than untag everything if the tag never resolved.
            [ -n "${IMAGE_TAG:-}" ] || exit 0
            docker image ls --filter "reference=${REGISTRY}/stigvidd-*:*" \
                            --format '{{.Repository}}:{{.Tag}}' \
              | grep -v ":${IMAGE_TAG}$" \
              | xargs -r docker rmi || true
            docker image prune -f >/dev/null || true
          '''
          cleanWs()
        }
      }
    }

    stage('Deploy') {
      agent any
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
      post { always { cleanWs() } }
    }
  }
}
