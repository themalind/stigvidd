// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Media;

public class UpdateImageMetadataRequest
{
    public string? AltText { get; set; }
    public string? Caption { get; set; }
}
