// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Trail;

public class TrailLinkResponse
{
    public required string Identifier { get; set; }
    public required string Link { get; set; }
    public required string Title { get; set; }

    public static TrailLinkResponse Create(string identifier, string link, string title)
    {
        return new TrailLinkResponse
        {
            Identifier = identifier,
            Link = link,
            Title = title
        };
    }
}

