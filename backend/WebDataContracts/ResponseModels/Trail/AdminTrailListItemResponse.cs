// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Trail;

public class AdminTrailListItemResponse
{
    public required string Identifier { get; set; }
    public required string Name { get; set; }
    public required decimal TrailLength { get; set; }
    public bool Accessibility { get; set; }
    public int Classification { get; set; }
    public required string City { get; set; }
    public bool IsVerified { get; set; }
    public bool HasImages { get; set; }
    public bool HasExampleImages { get; set; }
    public bool HasSymbol { get; set; }
    public bool HasDescription { get; set; }
    public bool HasFullDescription { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime LastUpdatedAt { get; set; }
}
