// Stigvidd CI/CD pipeline.
//
// Flow: test -> build images -> push to registry -> deploy to a remote host
// over SSH (docker compose pull && up -d).
//
// ─────────────────────────────────────────────────────────────────────────
// One-time setup on the Jenkins controller:
//
//  1. Credentials (Manage Jenkins > Credentials):
//       - id: registry-credentials   type: Username/Password
//           registry: https://inkaben.se/  (host inkaben.se, API at /v2/)
//           user: stigvidd   (password stored in Jenkins, never in git)
//       - id: deploy-ssh-key         type: SSH Username with private key (deploy host)
//
//  2. The build agent needs: docker + `docker compose` v2, and ssh/scp.
//     (The test stages run in their own toolchain containers, so the agent
//      only needs Docker itself for those.)
//
//  3. On the DEPLOY HOST, at $DEPLOY_PATH, keep a persistent `.env` holding the
//     runtime secrets that must NOT live in Jenkins/git:
//       POSTGRES_PASSWORD=...   (+ POSTGRES_DB / POSTGRES_USER / ports if non-default)
//     REGISTRY and IMAGE_TAG are injected by this pipeline at deploy time.
//
//  4. Adjust the CONFIGURE block below (registry, deploy host/path, VITE_* build
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

    // Immutable per-commit tag; keeps deploys traceable and rollbacks easy.
    IMAGE_TAG = "${env.GIT_COMMIT ? env.GIT_COMMIT.take(12) : env.BUILD_NUMBER}"
  }

  stages {
    stage('Test') {
      parallel {
        stage('backend') {
          agent {
            docker {
              image 'mcr.microsoft.com/dotnet/sdk:10.0'
              args  '-u root'   // allow apt-get for SpatiaLite
            }
          }
          steps {
            dir('backend') {
              sh '''
                apt-get update
                apt-get install -y libsqlite3-mod-spatialite libspatialite-dev
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
          agent { docker { image 'node:24' } }
          steps {
            dir('web') {
              sh '''
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
      agent any
      when { branch 'main' }   // only publish from main; PRs stop after Test
      steps {
        withCredentials([usernamePassword(
          credentialsId: 'registry-credentials',
          usernameVariable: 'REG_USER',
          passwordVariable: 'REG_PASS')]) {
          // The exported vars are throwaways purely to satisfy compose's
          // whole-file interpolation (required ${..:?} refs on the db/api/media
          // services). None are baked into the images — api/web/media read
          // their real values from the host .env at runtime.
          sh '''
            export POSTGRES_PASSWORD=ci-build-not-used
            export WEBDAV_USER=ci WEBDAV_PASSWORD=ci-build-not-used
            export PRESENTABLE_BASE_URL=http://ci-not-used/
            export WEB_DOMAIN=ci API_DOMAIN=ci MEDIA_DOMAIN=ci AUTH_DOMAIN=ci ACME_EMAIL=ci@ci
            export KEYCLOAK_URL=http://ci-not-used KC_ADMIN_USER=ci KC_ADMIN_PASSWORD=ci
            echo "$REG_PASS" | docker login "${REGISTRY%%/*}" -u "$REG_USER" --password-stdin
            docker compose build api web media proxy keycloak
            docker compose push api web media proxy keycloak
            docker logout "${REGISTRY%%/*}"
          '''
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

  post {
    always {
      node('') { cleanWs() }
    }
  }
}
