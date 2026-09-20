// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Media;

public class CreateMediaReprocessJobRequest
{
    public required IReadOnlyCollection<string> MediaIdentifiers { get; set; }
    public required ImageProcessingOptionsRequest Options { get; set; }
}
