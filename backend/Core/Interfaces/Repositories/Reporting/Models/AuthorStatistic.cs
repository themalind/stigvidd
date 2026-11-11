// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories.Reporting.Models;

// keep-comment: strikes count distinct content, so a review three people reported is one strike
public record AuthorStatistic(
    int AuthorUserId,
    string? Identifier,
    string? NickName,
    int Strikes,
    DateTime? BannedAt,
    int BanCount);
