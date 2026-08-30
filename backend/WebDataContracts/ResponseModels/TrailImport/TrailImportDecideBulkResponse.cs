// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.TrailImport;

// How many proposals the batch actually decided. A named type rather than an anonymous
// one so the generated web client is typed against the shape that is really on the wire.
public class TrailImportDecideBulkResponse
{
    public required int Decided { get; set; }

    public static TrailImportDecideBulkResponse Create(int decided)
    {
        return new TrailImportDecideBulkResponse { Decided = decided };
    }
}
