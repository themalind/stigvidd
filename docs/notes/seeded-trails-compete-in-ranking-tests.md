# A popular-trails ranking test competes with the standard seed: six verified GeoPath trails at one location

`TestBase.CreateSeededFactory()` always runs
[`Utilities.InitializeDbForTests`](../../backend/Tests/UnitTests/Utilities.cs) first, and the
`extraSeed` callback adds to that rather than replacing it. Counted in that seed:

- **six** trails that are `IsVerified = true` **and** carry a `GeoPath` — so all six satisfy
  the `where t.IsVerified && t.GeoPath != null` filter every ranking query starts with;
- every one of them starting at the **same** point, `(12.80, 57.62)`;
- review averages up to **4.75** (`Rating` 5.0 and 4.5 on the same trail).

The comment on `TrailRepositoryTests.VerifiedGeoTrail` used to say the seed trails have no
`GeoPath`. They do, and have since before the SRID work touched them.

## Why this is a trap specifically for a proximity test

The obvious way to write one is to stand the user on the trails you seeded — and the obvious
coordinate to use is `(12.80, 57.62)`, because that is what `VerifiedGeoTrail` defaults to.
Do that and all six seed trails are also at distance zero, so each collects the **full**
`ProximityBoostPoints` of 5.0 on top of its rating: up to **9.75**. A test trail rated 2.0 on
the doorstep scores 7.0 and loses to trails it never mentioned. The assertion then passes or
fails for reasons that have nothing to do with what it claims to test, and `.First()` is
whichever seed row EF happened to order first.

The fix is to put the user somewhere the seed cannot reach. `GetPopularTrailOverviews_WithLocation_*`
use `(59.00, 18.00)` — about 335 km away, which leaves every seed trail a boost of roughly
0.07 and a ceiling near 4.8, comfortably under the trails the test actually seeds.

`GetPopularTrailOverviews_WithoutLocation_OrdersByRatingDescending` is safe for the same
reason from the other direction: it asserts a 5.0-rated trail first, and 5.0 beats the seed's
4.75 ceiling outright. That margin is one review away from disappearing, though — it is not a
tie-break the test states or defends.

## The general shape

`extraSeed` is additive, so **any** assertion of the form "my row comes first" is really
"my row beats the standard seed as well", and the standard seed is 25 trails, 8 reviews, 5
hikes and a set of facilities. Either score past it deliberately, or place your fixtures where
its rows cannot rank — and say which in the test, because the next reader cannot see the seed
from the test body.

Related: [[srid-4326]], [[sqlite-foreign-keys-off-on-linux]].
