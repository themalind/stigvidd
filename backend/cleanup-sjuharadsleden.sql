-- Clear out the Sjuhäradsleden rows the 2026-08 export replaces.
--
-- Why: the source now ships ten contiguous etapper with their own lengths, where the
-- database holds 36 rows that are duplicates, import fragments and stale aggregates —
-- 21 of them named "Olsfors-kommungränsen" with 6-33 points each. Matching ten clean
-- features against them costs more review effort than it is worth, and 35 of the 36 are
-- not even published.
--
-- Nothing user-written is lost. The only review and the only wishlist entry sit on id
-- 318, which matches the new export exactly and is not touched here. Zero favourites.
-- The 142 images on these rows are the mock placeholders that sit on 135-140 trails each.
--
-- Verified before writing this script:
--   * 285's FullDescription is contained verbatim in 221's, so 285 has nothing unique.
--   * 244 is byte-identical to 242 in Description, FullDescription and Tags.
--   * 221's Description equals 302's, so only its FullDescription needs rescuing.
--
-- NOT handled here: id 242. It is the one published row, it has no counterpart in the
-- export, and its text is unique. It has to survive until the sync creates the new
-- Sjuhäradsrundan and that one is published. Delete it then, not now.
--
-- Runs as a dry run: the script ends in ROLLBACK. Change the last statement to COMMIT
-- once the printed numbers look right.
--   psql "<connection string>" -f cleanup-sjuharadsleden.sql
--
-- APPLIED to the test database 2026-08-20: 220 -> 188 trails, user_content 0, 302 kept
-- the 568-character description, no orphaned images, links, visitor info, favourites or
-- wishlist rows, and still zero fingerprint collisions. Not run against production.

\set ON_ERROR_STOP on

BEGIN;

\echo '== Rows to delete, with everything hanging off them =='
SELECT t."Id", t."Name", ST_NPoints(t."GeoPath") AS npoints, t."IsVerified",
       coalesce(length(t."Description"), 0) + coalesce(length(t."FullDescription"), 0) AS text_len,
       (SELECT count(*) FROM dbo."Reviews"       r WHERE r."TrailId" = t."Id")
     + (SELECT count(*) FROM dbo."UserFavorites" f WHERE f."TrailId" = t."Id")
     + (SELECT count(*) FROM dbo."UserWishList"  w WHERE w."TrailId" = t."Id") AS user_content
FROM dbo."Trails" t
WHERE t."Id" IN (221, 236, 244, 262, 263, 264, 265, 270, 274, 275, 282, 284, 285, 304,
                 306, 307, 308, 310, 314, 336, 338, 339, 340, 341, 342, 343, 354, 355,
                 356, 357, 358, 364)
ORDER BY t."Id";

\echo '== Guard: user_content must be 0 across all of them =='
SELECT coalesce(sum(c), 0) AS total_user_content
FROM (
    SELECT (SELECT count(*) FROM dbo."Reviews"       r WHERE r."TrailId" = t."Id")
         + (SELECT count(*) FROM dbo."UserFavorites" f WHERE f."TrailId" = t."Id")
         + (SELECT count(*) FROM dbo."UserWishList"  w WHERE w."TrailId" = t."Id") AS c
    FROM dbo."Trails" t
    WHERE t."Id" IN (221, 236, 244, 262, 263, 264, 265, 270, 274, 275, 282, 284, 285, 304,
                     306, 307, 308, 310, 314, 336, 338, 339, 340, 341, 342, 343, 354, 355,
                     356, 357, 358, 364)
) AS counts;

-- 221 and 302 are the same etapp; 302 is the one the export still matches, but 221 holds
-- the only copy of the long description. Move it before 221 goes.
-- Note: that text still claims "Sträckan genom Borås är 47 km", which the new per-etapp
-- lengths contradict. Worth editing on 302 afterwards.
UPDATE dbo."Trails" AS target
SET "FullDescription" = source."FullDescription"
FROM dbo."Trails" AS source
WHERE target."Id" = 302
  AND source."Id" = 221
  AND coalesce(target."FullDescription", '') = '';

\echo '== 302 after the text move =='
SELECT "Id", "Name",
       length("Description")     AS desc_len,
       length("FullDescription") AS full_len
FROM dbo."Trails" WHERE "Id" = 302;

DELETE FROM dbo."Trails"
WHERE "Id" IN (221, 236, 244, 262, 263, 264, 265, 270, 274, 275, 282, 284, 285, 304,
               306, 307, 308, 310, 314, 336, 338, 339, 340, 341, 342, 343, 354, 355,
               356, 357, 358, 364);

\echo '== Sjuhärads rows left (302, 318, 359 match the export; 242 waits for the sync) =='
SELECT "Id", "Name", "TrailLength", "IsVerified",
       coalesce(length("Description"), 0) + coalesce(length("FullDescription"), 0) AS text_len
FROM dbo."Trails"
WHERE "Name" ILIKE '%juhärad%' OR "Name" ILIKE '%Olsfors%'
ORDER BY "Id";

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
