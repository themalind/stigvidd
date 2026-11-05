// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.TrailImport.Apply;

// keep-comment: SourceSnapshot is the merge's baseline; without one nothing the source owns may be written
public record ApplyBaseline(int LinkId, int? TrailId, string? SourceSnapshot);
