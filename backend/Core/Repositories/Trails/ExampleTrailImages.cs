// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;

namespace Core.Repositories.Trails;

// keep-comment: placeholder photos every new trail starts with until real ones are added
public static class ExampleTrailImages
{
    public static readonly IReadOnlyList<string> Paths =
    [
        "mock/gesebol/b43a142f-1725-4a52-af54-6c5c4d052cab.webp",
        "mock/storsjon/8c8a0e23-998b-4ef6-983d-a025c9e13072.webp",
        "mock/hofsnas/ede21c70-080d-4eeb-be45-ca782ded623a.webp",
        "mock/fc564171-07b9-455e-9c17-7684dd2e40bb.webp",
        "mock/hofsnas/a506faee-66a1-4194-95c9-f8c36aafc3aa.webp",
    ];

    public static List<TrailImage> Create(int firstSortOrder)
    {
        return [.. Paths.Select((path, i) => new TrailImage { ImageUrl = path, SortOrder = firstSortOrder + i })];
    }
}
