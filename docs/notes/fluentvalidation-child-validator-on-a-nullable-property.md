<!--
SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Attaching a child validator to a nullable property has no clean form here, and the two obvious ones each fail differently

Sharing one ruleset between two requests is ordinary FluentValidation. Doing it in *this*
repo runs into three constraints that only collide on a **nullable** property, and each
attempt fails for a different reason with a different message.

The case: `MediaFilter` is reached two ways — as the base of `MediaLibraryQuery`
(`[FromQuery]`, non-null) and as `CreateMediaReprocessJobRequest.Filter` (`MediaFilter?`).
One `MediaFilterValidator` should serve both.

## The half that just works

`AbstractValidator<T>.Include` takes `IValidator<T>`, and FluentValidation declares
`IValidator<in T>` **contravariant**. So a validator for the base class attaches to a
validator for the derived one with no ceremony:

```csharp
public class MediaLibraryQueryValidator : AbstractValidator<MediaLibraryQuery>   // : MediaFilter
{
    public MediaLibraryQueryValidator() => Include(new MediaFilterValidator());  // compiles
}
```

## The half that does not

`SetValidator` on a nullable property wants `IValidator<MediaFilter?>`, and
`MediaFilterValidator : AbstractValidator<MediaFilter>` is not that — contravariance does
not help, because the nullable annotation is the thing that differs:

```
error CS8620: Argument of type 'MediaFilterValidator' cannot be used for parameter
'validator' of type 'IValidator<MediaFilter?>' ... due to differences in the nullability
of reference types.
```

Three ways out, and two of them are closed here:

| attempt | result |
| --- | --- |
| `RuleFor(r => r.Filter!)` | banned — CLAUDE.md forbids the null-forgiving operator |
| `Transform(r => r.Filter, f => f ?? new MediaFilter())` | **`Transform` does not exist.** `error CS0103: The name 'Transform' does not exist in the current context` — it was deprecated in FluentValidation 11 and **removed in 12**, which is what `Core.csproj` pins (12.1.1). Most guidance online predates that. |
| `AbstractValidator<MediaFilter?>` | every rule body then dereferences a maybe-null, and `WarningsAsErrors=nullable` in [Directory.Build.props](../../backend/Directory.Build.props) turns each one into a build error |

## What works

Forward the child's failures by hand from a `Custom` rule. The null check is an ordinary
early return, so nothing has to be asserted away:

```csharp
private static readonly MediaFilterValidator FilterRules = new();

When(request => request.Filter is not null, () =>
{
    RuleFor(request => request.Filter).Custom((filter, context) =>
    {
        if (filter is null)
            return;

        foreach (var failure in FilterRules.Validate(filter).Errors)
            context.AddFailure(failure);
    });
});
```

The `When` and the `if` look redundant and are not: `When` decides whether the rule runs at
all, and the `if` is what keeps `Validate(filter)` off a nullable argument without a `!`.

## Why it is worth sharing the ruleset at all

Before this, the same `MediaFilter` was validated twice over, differently.
`MediaLibraryQueryValidator` allow-listed `OwnerType`, `Format` and `TargetFormat`;
`CreateMediaReprocessJobRequestValidator` hand-copied only the four min/max coherence rules.
So `format=wepb` was a precise 400 on `GET /api/v1/admin/media` and
`"No images match that filter."` on `POST /api/v1/admin/media/reprocess` — the same typo,
one route telling the operator what was wrong and the other implying the library is empty.
Two integration tests now pin both routes to the same answer.

A related trap sits beside it: a validator that accepts a value **case-insensitively** must
be paired with a consumer that **canonicalises** rather than compares. See
[[ef-cannot-filter-or-order-through-a-constructor-projection]] for the measured version —
`?ownerType=trail` passed validation and returned an empty library.
