<!--
SPDX-FileCopyrightText: 2026 The Stigvidd Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Backend conventions

The structure of `backend/` is locked by the build and by tests. This page says what each rule
is, why it exists and what enforces it. A rule that is wrong is changed here **and** in its
enforcer in the same change. Do not quietly add an exception.

## Projects

```text
WebDataContracts  <-  Infrastructure  <-  Core  <-  StigviddAPI
WebDataContracts  <-  StigviddLinks
```

The project references enforce this direction: a project cannot use what it does not reference.
`WebDataContracts` holds the DTOs, and they are the contract the web client is generated from.

## Where things go in Core

```text
Core/Interfaces/Repositories/<Domain>/          repository interfaces only
Core/Interfaces/Repositories/<Domain>/Models/   their records, enums, filters, projections
Core/Interfaces/Services/<Domain>/              service interfaces only
Core/Interfaces/Services/<Domain>/Models/       their records, enums, results
Core/Repositories/<Domain>/                     EF queries, incl. ordering/scoring
Core/Services/<Domain>/                         logic, returns Result / RepositoryResult
Core/Factories/<Domain>/                        entity -> response
Core/Validators/<Domain>/                       FluentValidation, registered by assembly scan
Core/DomainEvents/                              the outbox mechanism, cross-cutting
Core/TrailImport/                               own namespaces, not in GlobalUsings
```

A helper used by one implementation only stays beside it, for example `LoadedEvent` in
`Core/Services/Events/`. A few cross-cutting files sit at a folder root on purpose:
`IMaintenanceGate`, `MaintenanceGate`, `UtcDates`, `SwedishCollation` and `ContractEnum`.

### Domains

Every layer uses the same domain names:

`Account`, `CityAreas`, `DataTransfer`, `DomainEvents`, `Events`, `Friends`, `Hikes`,
`HikeShares`, `Mail`, `Media`, `Push`, `Reporting`, `TrailImport`, `Trails`.

To add a domain, add its name to `Domains` in
`Tests/UnitTests/ArchitectureTests/CoreStructureTests.cs` and to the list above. A folder name
that is not in the list fails the test, so a typo such as `Trail/` next to `Trails/` cannot slip in.

## Rules and what enforces them

### Compiler (build error, `.editorconfig` + `Directory.Build.props`)

| Rule | Diagnostic | Why |
| --- | --- | --- |
| The namespace matches the folder | IDE0130 | A file's namespace tells you where it is |
| File-scoped `namespace X;` | IDE0161 | One indentation level less, one style |
| Methods have a `{ }` body with `return`, never `=>` | IDE0022 | One style, easy to add a line to. Lambdas passed as arguments are fine |
| One top-level type per file, named after the type | MA0048 (Meziantou) | You find a type by its file name |
| Nullable warnings are errors, and `!` is never used | `WarningsAsErrors=nullable` | A null is handled, not silenced |

MA0048 applies to production projects only. Test projects may keep a test's helper types in the
test file. EF-generated migrations are exempt from all four style rules.

`Meziantou.Analyzer` runs with `MeziantouAnalysisMode=None`, so only the rules turned on in
`.editorconfig` are active. Turn on another rule there, one at a time.

### Architecture tests (`Tests/UnitTests/ArchitectureTests/`)

`CoreStructureTests` (reflection over Core):

- `Core/Interfaces/**` holds only interfaces outside `Models/`, and `Models/` holds no interfaces.
- Domain folders use only the names in `Domains`.
- A class named `*Repository` lives in `Core/Repositories/<Domain>/`, a `*Service` in
  `Core/Services/<Domain>/`, a `*ResponseFactory` in `Core/Factories/<Domain>/`, and an
  `AbstractValidator<T>` in `Core/Validators/<Domain>/`.

`LayerDependencyTests` (ArchUnitNET over all four production assemblies):

| Layer | Must not depend on | Why |
| --- | --- | --- |
| Controllers | repositories, `Infrastructure.Data` | Controllers are thin and call services |
| Repositories | service interfaces | Data access does not call back up into logic |
| Factories | repositories, services, `StigViddDbContext` | A factory maps what it is given and reads nothing |
| Validators | repositories, services, `StigViddDbContext` | A validator checks the request's shape |
| Services | `StigViddDbContext` | Services reach data through repositories |

Types in a `Models/` folder are plain data, so every layer may use them. Two exceptions are written
in the tests with their reason:

- `MailTemplateResponseFactory` uses `IMailTemplateRenderer`, which only parses placeholders out of text.
- `Core/Services/DataTransfer/` uses the DbContext directly, because it moves whole tables between
  environments.

Run only these tests with:

```sh
cd backend && dotnet test --project Tests/UnitTests/UnitTests.csproj --filter-namespace UnitTests.ArchitectureTests
```

### By review (not checked automatically)

- A controller action is thin: it validates, calls one service and maps the `Result`. Admin
  controllers live in `Controllers/Admin/` with `[Authorize(Policy = "AdminOnly")]`.
- Services return `Result`, and repositories return `RepositoryResult`. Neither throws for an expected failure.
- A request `DateTime` goes through `UtcDates.ToUtc`. Geometry is built only through `GeoPointFactory.FromLonLat`.
- An error with a `Message.Code` becomes ProblemDetails with a `code`. Without one, it becomes a
  plain string, which shipped apps read.
- Tests use xunit.v3, AwesomeAssertions (never FluentAssertions) and Moq, and pass
  `TestContext.Current.CancellationToken`.
- Comments are short and say what the code does.

## Adding a feature: the checklist

1. Choose the domain. If it is new, see [Domains](#domains).
2. Add the DTOs in `WebDataContracts/{RequestModels,ResponseModels}/<Domain>/`, one type per file.
3. Add the interfaces, with their data types in `Models/`.
4. Add the repository, the service, the factory and the validator in their `<Domain>/` folders.
   Register them in `Core/ServiceCollectionExtensions.cs`; validators are registered by the scan.
5. Add a thin controller.
6. Run `dotnet build`, regenerate the web client and commit `web/src/api/generated`.
   The `add-an-endpoint` skill has the details.
