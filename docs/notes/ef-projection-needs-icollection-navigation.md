# An EF Core projection cannot materialize an IReadOnlyCollection navigation; declare it ICollection

**Symptom.** After `HikeService.GetHikesAsync` and `HikeShareRecipientService` started passing
`h.Images` into `HikeResponseFactory.CreateImages(...)` inside their `selector`, every request
through those projections returned 500. The integration suite (SQLite) showed:

```
System.ArgumentException: GenericArguments[1], 'System.Collections.Generic.IReadOnlyCollection`1[Infrastructure.Data.Entities.HikeImage]',
on 'TCollection InitializeCollection[TElement,TCollection](...)' violates the constraint of type 'TCollection'.
```

Unit tests were green: they mock the repository, so the expression is never compiled by EF.

**Why it looks fine.** The same navigation loads without complaint through
`.Include(h => h.Images)` (the change tracker fills it), and a client-evaluated top-level
projection with a plain column (`GeoPathSerializer.ToCoordinateJson(h.GeoPath)`) works. Only
the projection shaper builds the collection itself, and its `InitializeCollection` requires
`TCollection : ICollection<TElement>`. `IReadOnlyCollection<T>` does not satisfy that.

**Fix.** `Hike.Images` is now `ICollection<HikeImage>?`, like `Review.ReviewImages` and
`Trail.TrailImages`. A navigation's CLR type is not in the model snapshot, so no migration.
Passing the nullable navigation to a static, null-tolerant helper (`CreateImages(baseUrl,
h.Images)`) also avoids the null-forgiving `!` that `r.ReviewImages!.Select(...)` uses
elsewhere.

**Rule.** A collection navigation that any `selector` projects must be `ICollection<T>`, and
only an integration test (real EF provider) proves the projection compiles.

See [HikeResponseFactory.cs](../../backend/Core/Factories/HikeResponseFactory.cs) and
[Hike.cs](../../backend/Infrastructure/Data/Entities/Hike.cs).
