// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories;

public record CancelledEvent(string Title, DateTime StartsAt, IReadOnlyCollection<int> NotifyUserIds);
