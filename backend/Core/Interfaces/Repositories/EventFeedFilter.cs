// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories;

public record EventFeedFilter(
    int ViewerId,
    int[] HiddenUserIds,
    DateTime Now,
    string? TrailIdentifier,
    string? OrganizerIdentifier,
    EventSearch Search,
    EventOrder Order,
    int Limit,
    bool ExcludeMine);
