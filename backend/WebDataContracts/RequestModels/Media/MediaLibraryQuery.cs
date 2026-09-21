// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Media;

public class MediaLibraryQuery : MediaFilter
{
    public const int MaxPageSize = 200;
    public const int DefaultPageSize = 48;

    // keep-comment: bounds Page so (Page - 1) * PageSize cannot overflow int - unbounded, page 20000000 wraps negative, Skip clamps it to zero and the endpoint serves page 1 while reporting the page asked for and hasMore true
    public const int MaxPage = 100_000;

    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = DefaultPageSize;

    // keep-comment: the accepted values, which nothing else in the type system pins: newest | oldest | largest | widest
    public string? Sort { get; set; }
}
