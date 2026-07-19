-- Dedicated database for Keycloak, inside the app's Postgres instance, so the
-- existing pgdata backup/restore carries Keycloak's realms, users and clients
-- too. Idempotent (\gexec runs the CREATE only if the db is absent).
--
-- NOTE: init scripts run only when the data directory is first created. For an
-- EXISTING/migrated pgdata volume, create it once by hand:
--   docker compose exec db createdb -U "$POSTGRES_USER" keycloak
SELECT 'CREATE DATABASE keycloak'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'keycloak')\gexec
