// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Trail;

public class AdminTrailListItemResponse
{
    public required string Identifier { get; set; }
    public required string Name { get; set; }
    public required decimal TrailLength { get; set; }
    public required bool Accessibility { get; set; }
    public required int Classification { get; set; }
    public required string City { get; set; }
    public required bool IsVerified { get; set; }
    public required bool HasImages { get; set; }
    public required bool HasExampleImages { get; set; }
    public required bool HasSymbol { get; set; }
    public required bool HasDescription { get; set; }
    public required bool HasFullDescription { get; set; }
    public required DateTime CreatedAt { get; set; }
    public required DateTime LastUpdatedAt { get; set; }
}
