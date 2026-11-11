// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Services.Events;

public sealed record LoadedEvent(int ViewerId, EventDetail Detail, EventMembership Membership, bool ShowOrganizer, int[] HiddenUserIds);
