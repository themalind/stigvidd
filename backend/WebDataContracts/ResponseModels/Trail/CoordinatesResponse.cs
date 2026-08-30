// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later


namespace WebDataContracts.ResponseModels.Trail;

public class CoordinatesResponse
{
    public required string Coordinates { get; set; }

    public static CoordinatesResponse Create(string coordinates)
    {
        return new CoordinatesResponse
        {
            Coordinates = coordinates
        };
    }
}
