// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Enums;

namespace Core.TrailImport.Apply;

// keep-comment: TrailId is null for an excluded feature, and for a trail this apply creates, where CreatedForProposalId names that create
public record LinkWrite(
    int? LinkId,
    string GeometryFingerprint,
    string ExternalId,
    int? TrailId,
    int? CreatedForProposalId,
    TrailSourceLinkRole Role,
    MatchConfidence Confidence,
    string? SourceSnapshot,
    // keep-comment: stops a later sync from re-pointing the link on its own
    bool ConfirmedByHuman);
