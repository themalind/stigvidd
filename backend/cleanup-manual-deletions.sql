-- Remove the four trail rows that were deleted by hand in the test database.
--
-- Why: 280, 292, 252 and 311 were removed one at a time during the import work, without a
-- script. This is that script, written afterwards so production can be given the same
-- treatment in one reviewed step instead of from memory.
--
--   280  no name at all, 60.56 km, 30 402 points, unpublished. It escaped
--        cleanup-sjuharadsleden.sql only because that query filtered on the name. Four of
--        the new etapper lie 100 % inside it, so it is one more stale aggregate.
--   292  the same path as 373 "Rya åsar Vildmarksspåret": 9.00 km, 100 % mutual coverage,
--        5 m apart. Its Description is the better of the two and is moved to 373 below.
--   252  a third "Tångenleden", lying 100 % inside id 3, unlinked and unpublished.
--   311  an 8.6 m fragment of "Kröcklings Hage"; 100 % of it lies within 25 m of 305.
--
-- All eight FKs to dbo."Trails" are ON DELETE CASCADE, so the DELETE also removes the
-- dependent rows the report below prints. Read that report before committing: the test
-- database had no user content on any of these four, production may.
--
-- NOT handled here: 271, 305, 268, 309 and 253. They are deletion candidates but each
-- needs a decision first — see docs/ledbestand-mot-produktion.md.
--
-- Runs as a dry run: the script ends in ROLLBACK. Change the last statement to COMMIT
-- once the printed numbers look right.
--   psql "<connection string>" -f cleanup-manual-deletions.sql
--
-- APPLIED to the test database one row at a time between 2026-08-21 and 2026-08-23, not as
-- this script. Not run against production.

\set ON_ERROR_STOP on

BEGIN;

\echo '== Rows to delete — check the names against the documented ones =='
SELECT t."Id", t."Name", t."IsVerified",
       ST_NPoints(t."GeoPath")                          AS npoints,
       round(ST_Length(t."GeoPath"::geography)::numeric) AS length_m,
       coalesce(length(t."Description"), 0) + coalesce(length(t."FullDescription"), 0) AS text_len
FROM dbo."Trails" t
WHERE t."Id" IN (252, 280, 292, 311)
ORDER BY t."Id";

\echo '== Dependent rows that CASCADE will take with them =='
SELECT 'VisitorInformations' AS table_name, count(*) FROM dbo."VisitorInformations" WHERE "TrailId" IN (252,280,292,311)
UNION ALL SELECT 'TrailImages',    count(*) FROM dbo."TrailImages"    WHERE "TrailId" IN (252,280,292,311)
UNION ALL SELECT 'TrailLinks',     count(*) FROM dbo."TrailLinks"     WHERE "TrailId" IN (252,280,292,311)
UNION ALL SELECT 'Reviews',        count(*) FROM dbo."Reviews"        WHERE "TrailId" IN (252,280,292,311)
UNION ALL SELECT 'TrailObstacles', count(*) FROM dbo."TrailObstacles" WHERE "TrailId" IN (252,280,292,311)
UNION ALL SELECT 'CityAreaTrail',  count(*) FROM dbo."CityAreaTrail"  WHERE "TrailId" IN (252,280,292,311)
UNION ALL SELECT 'UserFavorites',  count(*) FROM dbo."UserFavorites"  WHERE "TrailId" IN (252,280,292,311)
UNION ALL SELECT 'UserWishList',   count(*) FROM dbo."UserWishList"   WHERE "TrailId" IN (252,280,292,311);

\echo '== Guard: user content must be 0 across all four =='
SELECT coalesce(sum(c), 0) AS total_user_content
FROM (
    SELECT (SELECT count(*) FROM dbo."Reviews"       r WHERE r."TrailId" = t."Id")
         + (SELECT count(*) FROM dbo."UserFavorites" f WHERE f."TrailId" = t."Id")
         + (SELECT count(*) FROM dbo."UserWishList"  w WHERE w."TrailId" = t."Id") AS c
    FROM dbo."Trails" t WHERE t."Id" IN (252, 280, 292, 311)
) AS counts;

\echo '== The two Rya åsar descriptions — 292 goes to 373 =='
SELECT "Id", "Name", length("Description") AS desc_len, left("Description", 100) AS starts_with
FROM dbo."Trails" WHERE "Id" IN (292, 373) ORDER BY "Id";

UPDATE dbo."Trails" AS target
SET "Description" = source."Description"
FROM dbo."Trails" AS source
WHERE target."Id" = 373
  AND source."Id" = 292
  AND coalesce(source."Description", '') <> '';

\echo '== 373 after the text move =='
SELECT "Id", "Name", length("Description") AS desc_len FROM dbo."Trails" WHERE "Id" = 373;

DELETE FROM dbo."Trails" WHERE "Id" IN (252, 280, 292, 311);

\echo '== Trails that share a name, case-insensitively, after the delete =='
SELECT lower("Name") AS name_lower, count(*) AS n,
       string_agg("Id"::text, ', ' ORDER BY "Id") AS ids
FROM dbo."Trails" GROUP BY 1 HAVING count(*) > 1 ORDER BY 2 DESC, 1;

\echo '== Geometry fingerprint collisions (must stay zero) =='
SELECT count(*) AS collision_groups
FROM (
    SELECT ST_StartPoint("GeoPath"), ST_EndPoint("GeoPath"), ST_NPoints("GeoPath")
    FROM dbo."Trails" WHERE "GeoPath" IS NOT NULL
    GROUP BY 1, 2, 3 HAVING count(*) > 1
) AS duplicates;

\echo '== Trail count =='
SELECT count(*) AS trails FROM dbo."Trails";

-- Change to COMMIT to apply.
ROLLBACK;
