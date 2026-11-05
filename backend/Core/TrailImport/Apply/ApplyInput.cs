// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.TrailImport.Apply;

// keep-comment: everything the apply phase reads before it writes anything
public record ApplyInput(
    IReadOnlyList<ApplyFeature> Features,
    IReadOnlyDictionary<int, ApplyTarget> Targets,
    IReadOnlyDictionary<string, ApplyBaseline> LinksByFingerprint,
    // keep-comment: on the first sync a trail is absent here, and then no source-owned field is written on it
    IReadOnlySet<int> TrailsWithBaseline);
