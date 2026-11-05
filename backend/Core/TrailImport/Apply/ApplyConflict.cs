// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.TrailImport.Apply;

// keep-comment: a source-owned field both sides changed; ours stands and the difference is reported
public record ApplyConflict(int TrailId, string TrailName, string Field, string Ours, string Theirs);
