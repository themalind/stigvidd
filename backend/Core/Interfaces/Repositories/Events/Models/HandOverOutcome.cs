// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories.Events.Models;

// What an organizer's departure did: a CoHost took over, the event was cancelled (CancelNotifyUserIds says who must hear), or neither for a past or already-cancelled event. keep-comment: facts only; the service words the pushes
public sealed record HandOverOutcome(string EventIdentifier, string Title, DateTime StartsAt, bool WasUpcoming, int? NewOrganizerUserId, IReadOnlyCollection<int> CancelNotifyUserIds);
