-- Remove the MOCK seed trails and normalise the one that is kept.
--
-- Why: ids 1, 2, 4-9 are start-up seed data that no longer exists in the Borås Stad
-- source, and six of them are exact geometric duplicates of real trails (1=302,
-- 2=424, 4=318, 5=289, 6=304, 8/9=254). Those duplicates are the ONLY fingerprint
-- collisions in the trail table, so the planned unique index on
-- (Source, GeometryFingerprint) in TrailSourceLink cannot be created until they are
-- gone. Id 3 Tångenleden is real content and stays; it only needs its CreatedBy and
-- its absolute symbol URL corrected.
--
-- All eight FKs to dbo."Trails" are ON DELETE CASCADE, so the DELETE also removes the
-- dependent rows the report below prints. Read that report before committing.
--
-- Runs as a dry run: the script ends in ROLLBACK. Change the last statement to COMMIT
-- once the printed numbers look right.
--   psql "<connection string>" -f cleanup-mock-trails.sql

\set ON_ERROR_STOP on

BEGIN;

\echo '== Trails to delete =='
SELECT t."Id", t."Name", t."CreatedBy", t."IsVerified",
       ST_NPoints(t."GeoPath")                                AS npoints,
       round(ST_Length(t."GeoPath"::geography)::numeric)       AS length_m
FROM dbo."Trails" t
WHERE t."Id" IN (1, 2, 4, 5, 6, 7, 8, 9)
ORDER BY t."Id";

\echo '== Dependent rows that CASCADE will take with them =='
SELECT 'VisitorInformations' AS table_name, count(*) FROM dbo."VisitorInformations" WHERE "TrailId" IN (1,2,4,5,6,7,8,9)
UNION ALL SELECT 'TrailImages',     count(*) FROM dbo."TrailImages"     WHERE "TrailId"  IN (1,2,4,5,6,7,8,9)
UNION ALL SELECT 'TrailLinks',      count(*) FROM dbo."TrailLinks"      WHERE "TrailId"  IN (1,2,4,5,6,7,8,9)
UNION ALL SELECT 'Reviews',         count(*) FROM dbo."Reviews"         WHERE "TrailId"  IN (1,2,4,5,6,7,8,9)
UNION ALL SELECT 'TrailObstacles',  count(*) FROM dbo."TrailObstacles"  WHERE "TrailId"  IN (1,2,4,5,6,7,8,9)
UNION ALL SELECT 'CityAreaTrail',   count(*) FROM dbo."CityAreaTrail"   WHERE "TrailId"  IN (1,2,4,5,6,7,8,9)
UNION ALL SELECT 'UserFavorites',   count(*) FROM dbo."UserFavorites"   WHERE "TrailId"  IN (1,2,4,5,6,7,8,9)
UNION ALL SELECT 'UserWishList',    count(*) FROM dbo."UserWishList"    WHERE "TrailId"  IN (1,2,4,5,6,7,8,9);

\echo '== User-written reviews that will be lost — check these before committing =='
SELECT r."Id", r."TrailId", r."UserId", r."Rating", left(r."TrailReview", 80) AS review
FROM dbo."Reviews" r
WHERE r."TrailId" IN (1, 2, 4, 5, 6, 7, 8, 9)
ORDER BY r."Id";

DELETE FROM dbo."Trails" WHERE "Id" IN (1, 2, 4, 5, 6, 7, 8, 9);

-- Id 3 is real content credited to the wrong author, with a symbol URL that bypasses
-- PresentableBaseUrl. Every other symbol is a relative "symbols/<file>" path.
UPDATE dbo."Trails"
SET "CreatedBy" = 'Borås Stad',
    "TrailSymbolImage" = 'mock/mock-trail-symbol.png'
WHERE "Id" = 3
  AND "TrailSymbolImage" = 'https://inkaben.se/stigvidd/mock/mock-trail-symbol.png';

\echo '== Remaining MOCK rows (id 3 should now read Borås Stad) =='
SELECT "Id", "Name", "CreatedBy", "TrailSymbolImage"
FROM dbo."Trails"
WHERE "CreatedBy" = 'MOCK' OR "Id" = 3
ORDER BY "Id";

\echo '== Geometry fingerprint collisions left (must be zero) =='
SELECT count(*) AS collision_groups
FROM (
    SELECT ST_StartPoint("GeoPath"), ST_EndPoint("GeoPath"), ST_NPoints("GeoPath")
    FROM dbo."Trails"
    WHERE "GeoPath" IS NOT NULL
    GROUP BY 1, 2, 3
    HAVING count(*) > 1
) AS duplicates;

\echo '== Trail count =='
SELECT count(*) AS trails FROM dbo."Trails";

-- Change to COMMIT to apply.
ROLLBACK;
