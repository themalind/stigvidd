// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories.Media.Models;

// keep-comment: rows share files (placeholders by the hundred), so a success reports how many rows moved and whether the old file may be deleted
public record MediaReprocessSuccess(int RowsRepointed, bool OldFileStillReferenced);
