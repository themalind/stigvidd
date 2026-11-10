// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Microsoft.AspNetCore.Http.Features;

namespace StigviddAPI.Extensions;

public static class UploadLimitExtensions
{
    // One upload can carry several full-size photos; they are downscaled after upload.
    private const long MaxUploadBytes = 100L * 1024 * 1024;

    public static WebApplicationBuilder AddStigviddUploadLimits(this WebApplicationBuilder builder)
    {
        builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = MaxUploadBytes);
        builder.Services.Configure<FormOptions>(options => options.MultipartBodyLengthLimit = MaxUploadBytes);
        return builder;
    }
}
