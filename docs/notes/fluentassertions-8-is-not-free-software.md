# FluentAssertions 8.x is not free software, and nothing in the build says so

`FluentAssertions` 8.10.0 was a normal-looking `<PackageReference>` in both test projects.
Its licence is the **Xceed Software Inc. Community License Agreement (for Non-Commercial
Use)** — not Apache-2.0, and not any free software licence.

The version boundary is the whole point: **7.2.0 and earlier are Apache-2.0; 8.0.0 (January
2025) onward is Xceed's.** A routine major-version bump is all it takes to cross it.

## What the licence actually says

Read from `~/.nuget/packages/fluentassertions/8.10.0/LICENSE`:

- use is permitted only where "the primary objective is not to gain commercial advantage or
  monetary compensation";
- explicitly excluded is use "by or for an organisation, group of persons, legal entity, or
  company, that charges fees or earns revenues", and any resulting work that is "sold,
  leased, or sublicensed";
- the grant is revocable "unless/until revoked by Xceed at its sole discretion".

A field-of-use restriction like that fails FSF freedom 0 and OSI criterion 6. It also sat
inside a repository whose own licence is the AGPL.

## How to spot the next one, because the build never will

`dotnet build` and `dotnet test` are completely silent about licences. The tell is in the
`.nuspec`, and it is one line:

```sh
grep -o '<license[^<]*</license>' ~/.nuget/packages/<pkg>/<version>/<pkg>.nuspec
```

- `<license type="expression">Apache-2.0</license>` — an SPDX expression. Fine.
- `<license type="file">LICENSE</license>` — **read the file.** A custom licence is the
  reason a package cannot state an SPDX id, and it is how FluentAssertions 8 looked.

Every other package in `backend/` resolves to an SPDX expression; this was the only
`type="file"` in the tree.

## What replaced it

`AwesomeAssertions` 9.6.0 — the Apache-2.0 community fork of FluentAssertions 7, with a
clean `<license type="expression">Apache-2.0</license>`. The swap is the package reference
plus a namespace change in the 96 test files that had `using FluentAssertions;`; the
namespace **is** renamed to `AwesomeAssertions`, so it is not a drop-in on the `using` line
(everything after it is API-compatible).

A namespace that resolved to nothing would be a build error, not a silent skip, so the
build passing is real evidence here. It was still checked by mutation: changing
`BeApproximately(111372, 100)` to `999999` in `LocalMetricProjectionTests` failed exactly 1
test, so the assertions bite rather than no-op. Suite after the swap: **1431 passed, 0
failed** (1095 unit + 336 integration).

Related: [[licence-is-per-area-not-repo-wide]].
