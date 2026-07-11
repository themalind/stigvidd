-- Ensure the PostGIS extension exists before the API's EF migrations run.
-- Executed once by the postgres entrypoint on first initialisation of an
-- empty data directory.
CREATE EXTENSION IF NOT EXISTS postgis;
