// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories.Events.Models;

// NotifyUserIds is empty unless the event was still published and upcoming. keep-comment: nobody needs telling about a past or already-cancelled event
public record EventDeletion(string Identifier, string Title, DateTime StartsAt, string? ImageUrl, IReadOnlyCollection<int> NotifyUserIds);
