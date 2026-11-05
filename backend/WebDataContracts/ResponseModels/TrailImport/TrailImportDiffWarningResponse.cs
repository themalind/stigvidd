// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.Enums;

namespace WebDataContracts.ResponseModels.TrailImport;

public class TrailImportDiffWarningResponse
{
    public required int ProposalId { get; set; }
    public required string FeatureName { get; set; }
    public required ProposalDecision Decision { get; set; }
    public required MatchConfidence Confidence { get; set; }
    public required double CoverageForward { get; set; }
    public required string? TrailName { get; set; }

    public static TrailImportDiffWarningResponse Create(
        int proposalId,
        string featureName,
        ProposalDecision decision,
        MatchConfidence confidence,
        double coverageForward,
        string? trailName)
    {
        return new TrailImportDiffWarningResponse
        {
            ProposalId = proposalId,
            FeatureName = featureName,
            Decision = decision,
            Confidence = confidence,
            CoverageForward = coverageForward,
            TrailName = trailName
        };
    }
}
