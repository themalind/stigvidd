// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Media;

public class CreateMediaReprocessJobRequest
{
    // keep-comment: exactly one of these two; MediaIdentifiers must NOT be `required`, because System.Text.Json enforces that on deserialization and would reject a filter-only body with a framework 400 before any validator runs
    public IReadOnlyCollection<string>? MediaIdentifiers { get; set; }
    public MediaFilter? Filter { get; set; }

    public required ImageProcessingOptionsRequest Options { get; set; }
}
