<!--
SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Third-party notices — Stigvidd backend

The backend is licensed under AGPL-3.0-or-later (see [`../LICENSE`](../LICENSE)). It uses the
NuGet packages below under their own terms. Apache-2.0 § 4(d) and BSD-3-Clause both require
that these notices travel with any redistribution.

Licences were read from each package's `.nuspec` in the local NuGet cache, for the exact
version referenced, rather than from documentation.

## Two entries that need more than a table row

**CsvHelper is dual-licensed `MS-PL OR Apache-2.0`, and this project elects Apache-2.0.**
The election matters: the FSF classes the Microsoft Public Licence as a free software licence
but **GPL-incompatible**, so the MS-PL arm could not be combined with AGPL-covered code. The
Apache-2.0 arm is GPLv3/AGPLv3-compatible. Used only by `MapData`.

**Magick.NET bundles native ImageMagick.** The managed wrapper is Apache-2.0 as listed; the
native binaries it ships carry the ImageMagick Licence (an Apache-2.0 derivative with its own
attribution requirement), along with their delegate libraries. This is the one third-party
native component that ships inside the deployed API image — `ImageProcessingService` uses it.

## Packages

| Package | Version | Licence |
| --- | --- | --- |
| AwesomeAssertions | 9.6.0 | Apache-2.0 |
| CsvHelper | 33.1.0 | MS-PL OR Apache-2.0 |
| Duende.AccessTokenManagement | 4.2.0 | Apache-2.0 |
| FluentValidation.DependencyInjectionExtensions | 12.1.1 | Apache-2.0 |
| FluentValidation | 12.1.1 | Apache-2.0 |
| Keycloak.AuthServices.Authentication | 3.0.0 | MIT |
| Keycloak.AuthServices.Sdk | 3.0.0 | MIT |
| Magick.NET-Q8-AnyCPU | 14.16.0 | Apache-2.0 |
| Microsoft.AspNetCore.Authentication.JwtBearer | 10.0.9 | MIT |
| Microsoft.AspNetCore.Mvc.Testing | 10.0.9 | MIT |
| Microsoft.AspNetCore.OpenApi | 10.0.9 | MIT |
| Microsoft.EntityFrameworkCore.Design | 10.0.9 | MIT |
| Microsoft.EntityFrameworkCore.InMemory | 10.0.9 | MIT |
| Microsoft.EntityFrameworkCore.Relational | 10.0.9 | MIT |
| Microsoft.EntityFrameworkCore.Sqlite.Core | 10.0.9 | MIT |
| Microsoft.EntityFrameworkCore.Sqlite.NetTopologySuite | 10.0.9 | MIT |
| Microsoft.EntityFrameworkCore.Sqlite | 10.0.9 | MIT † |
| Microsoft.Extensions.Configuration.UserSecrets | 10.0.9 | MIT |
| Microsoft.NET.Test.Sdk | 18.7.0 | MIT |
| Microsoft.OpenApi | 2.12.0 | MIT |
| Moq | 4.20.72 | BSD-3-Clause |
| NSwag.AspNetCore | 14.7.1 | MIT |
| NSwag.Core | 14.7.1 | MIT |
| NSwag.Generation | 14.7.1 | MIT |
| NetTopologySuite | 2.6.0 | BSD-3-Clause |
| Newtonsoft.Json | 13.0.4 | MIT |
| Npgsql.EntityFrameworkCore.PostgreSQL.NetTopologySuite | 10.0.2 | PostgreSQL |
| Npgsql.EntityFrameworkCore.PostgreSQL | 10.0.2 | PostgreSQL |
| Npgsql.NetTopologySuite | 10.0.3 | PostgreSQL |
| OpenTelemetry.Exporter.OpenTelemetryProtocol | 1.18.0 | Apache-2.0 |
| OpenTelemetry.Extensions.Hosting | 1.18.0 | Apache-2.0 |
| OpenTelemetry.Instrumentation.AspNetCore | 1.18.0 | Apache-2.0 |
| OpenTelemetry.Instrumentation.Http | 1.18.0 | Apache-2.0 |
| OpenTelemetry.Instrumentation.Runtime | 1.18.0 | Apache-2.0 |
| SQLitePCLRaw.bundle_e_sqlite3 | 2.1.13 | Apache-2.0 † |
| SQLitePCLRaw.provider.sqlite3 | 2.1.13 | Apache-2.0 |
| SharpGrip.FluentValidation.AutoValidation.Mvc | 2.0.0 | MIT |
| WebDav.Client | 2.9.0 | MIT |
| coverlet.collector | 10.0.1 | MIT |
| xunit.runner.visualstudio | 3.1.5 | Apache-2.0 |
| xunit.v3 | 3.2.2 | Apache-2.0 |

† Windows-only conditional reference, not present in this Linux NuGet cache. The licence is
that of the same repository as its cached sibling package (`Microsoft.EntityFrameworkCore.Sqlite.Core`,
`SQLitePCLRaw.provider.sqlite3` respectively). `SQLitePCLRaw.bundle_e_sqlite3` additionally
bundles SQLite itself, which is in the public domain.

## Container base images

The deployed API image builds on `mcr.microsoft.com/dotnet/sdk:10.0` and runs on
`mcr.microsoft.com/dotnet/aspnet:10.0`. .NET itself is MIT; the images are a Debian rootfs
whose packages carry their own free licences, under Microsoft's container image terms.
The runtime stage installs `postgresql-client` (PostgreSQL Licence), `curl`, and
`ca-certificates` (MPL-2.0, the Mozilla CA bundle). `gnupg` (GPL-3.0) is used only to add an
apt key and is purged in the same layer.

## Data

Trail and facility data for the Borås area comes from Borås Stad's open data portal and is
imported by `MapData`. No data files are committed to this repository.

That data is published under **Creative Commons CC0 1.0** — a public domain dedication, with
Borås Stad named as the rights holder in the portal's rights statement. CC0 waives copyright
rather than licensing it, so it imposes **no attribution, no share-alike and no conditions of
any kind**, and it is compatible with AGPL-3.0-or-later and MPL-2.0 alike. The credit this
project gives Borås Stad — `CreatedBy = "Borås Stad"` on imported rows, the source link in
the app and the mention in the Terms of Use — is therefore a **courtesy, not an obligation**.

Do not confuse this with the map basemap: OpenStreetMap data behind the MapTiler tiles is
**ODbL 1.0** and its attribution *is* required. Different source, different terms.
