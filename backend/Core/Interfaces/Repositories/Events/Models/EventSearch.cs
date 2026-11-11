// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.Enums;

namespace Core.Interfaces.Repositories.Events.Models;

// Text is trimmed and lower-case; From is inclusive and To exclusive on StartsAt. keep-comment: what the repository expects
public record EventSearch(
    string? Text = null,
    DateTime? From = null,
    DateTime? To = null,
    EventArea? Area = null,
    bool OnlyWithSpots = false,
    decimal? MinLengthKm = null,
    decimal? MaxLengthKm = null,
    EventRouteKind? RouteKind = null);
