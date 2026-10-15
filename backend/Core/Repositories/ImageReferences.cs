// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Core.Repositories;

internal static class ImageReferences
{
    // keep-comment: one file can back rows in any image table, under either spelling (docs/notes/media-files-are-shared-by-many-image-rows.md)
    public static async Task<bool> IsReferencedAsync(StigViddDbContext context, string imageUrl, CancellationToken ctoken)
    {
        var relative = imageUrl.TrimStart('/');
        var paths = new List<string> { relative, "/" + relative };

        return await context.HikeImages.AnyAsync(hi => paths.Contains(hi.ImageUrl), ctoken)
            || await context.ReviewImages.AnyAsync(ri => paths.Contains(ri.ImageUrl), ctoken)
            || await context.TrailImages.AnyAsync(ti => paths.Contains(ti.ImageUrl), ctoken)
            || await context.FacilityImages.AnyAsync(fi => paths.Contains(fi.ImageUrl), ctoken)
            || await context.CityAreas.AnyAsync(ca => ca.ImageUrl != null && paths.Contains(ca.ImageUrl), ctoken)
            || await context.Trails.AnyAsync(t => paths.Contains(t.TrailSymbolImage), ctoken);
    }
}
