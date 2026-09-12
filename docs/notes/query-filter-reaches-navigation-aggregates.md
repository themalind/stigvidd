# A global query filter DOES reach `t.Reviews!.Average(...)`, and `IgnoreQueryFilters` takes a list

Measured, not assumed, before the moderation work was built on it.

The eight trail-rating averages in this backend are written by the **caller** as an
`Expression` and handed to a repository that only plugs them into its `Select` — see
`TrailService.GetTrailCardByIdentifierAsync` and `TrailRepository.GetPopularTrailOverviewsAsync`.
The repository never sees the `Reviews` navigation, so it cannot filter it. The question was
whether a global query filter on `Review` reaches inside that navigation anyway.

**It does**, on EF InMemory and on SQLite alike, and in both shapes the codebase uses:

- the average sitting only in the caller's selector (the trail card, the card list, the
  full trail list, both city-area projections);
- the average sitting in a `let` that an `orderby` reads, which is the popularity ranking,
  in both its rating-only and its proximity branch.

So one filter covers all eight sites, and a projection someone adds later inherits it for
free. `ModerationQueryFilterTests` pins this; neutralising the filter to `r => true` fails
every one of those assertions.

## The signature the plan got wrong

EF Core 10.0.9 has the **named** filter overload, so this compiles:

```csharp
modelBuilder.Entity<Review>()
    .HasQueryFilter("Moderation", r => r.ModerationState == ModerationState.Visible);
```

But dropping one by name takes a **collection**, not a bare string:

```csharp
context.Reviews.IgnoreQueryFilters(["Moderation"])   // correct
context.Reviews.IgnoreQueryFilters("Moderation")     // does not compile
```

## `IgnoreQueryFilters` is per QUERY, not per entity

`ReviewRepository.UserReviews` is used two ways: standalone in
`AnonymizeReviewsByUserIdAsync`, and as a **subquery** whose `Select(r => r.Id)` feeds a
`Contains` against `ReviewImages` in `GetReviewImageUrlsByUserIdAsync`. Putting the call
only inside the helper is not enough to reason about; the outer query carries it too. Get
this wrong and account deletion silently stops cleaning hidden reviews' files off WebDAV,
with nothing red anywhere. `ModerationVisibilityRepositoryTests` is what holds it.
